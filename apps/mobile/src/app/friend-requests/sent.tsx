import type { SentFriendRequest } from '@repo/api-types';
import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';
import { Avatar } from '../../components/post-flow/Avatar';
import { MiniHeader } from '../../components/post-flow/MiniHeader';
import { cancelFriendRequest, getSentFriendRequests } from '../../lib/api';

// PC画面でも横に広がりすぎないよう、スマホの縦画面くらいの横幅に制限する
const CONTENT_MAX_WIDTH = 480;

export default function SentFriendRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<SentFriendRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  useEffect(() => {
    getSentFriendRequests()
      .then(setRequests)
      .catch((e) => {
        console.error('[送信済み申請の取得エラー]', e);
        setError('送信済みの申請を取得できませんでした');
      });
  }, []);

  const handleCancelled = (friendshipId: number) => {
    setRequests((prev) => (prev ? prev.filter((r) => r.friendshipId !== friendshipId) : prev));
  };

  return (
    <YStack flex={1} backgroundColor="#000" alignItems="center">
      <YStack flex={1} width="100%" maxWidth={CONTENT_MAX_WIDTH}>
        <MiniHeader title="送信済みの申請" onBack={goBack} />

        {error ? (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$5">
            <Text color="#e74c3c" fontSize={14} textAlign="center">
              {error}
            </Text>
          </YStack>
        ) : requests === null ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Spinner color="#555" />
          </YStack>
        ) : requests.length === 0 ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Text color="#555" fontSize={14}>
              送信済みの申請はありません
            </Text>
          </YStack>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}>
            <YStack gap="$4">
              {requests.map((request) => (
                <RequestRow key={request.friendshipId} request={request} onCancelled={handleCancelled} />
              ))}
            </YStack>
          </ScrollView>
        )}
      </YStack>
    </YStack>
  );
}

const POPUP_WIDTH = 230;

function RequestRow({ request, onCancelled }: { request: SentFriendRequest; onCancelled: (friendshipId: number) => void }) {
  const router = useRouter();
  const buttonRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // ユーザー詳細画面(#76/#78)は未実装のため、実装済みになったタイミングでそのまま繋がるルートへ遷移させておく
  const goToProfile = () => {
    if (!request.handle) return;
    router.push(`/users/${request.handle}`);
  };

  // ボタンの画面上の座標を計測してからポップアップを開く（Modalはツリーの外にポータルされるため、
  // 親のtransform等に影響されず正しい位置に配置できる）
  const openConfirm = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ top: y, left: x, width, height });
    });
  };

  const closeConfirm = () => setAnchor(null);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelFriendRequest(request.friendshipId);
      onCancelled(request.friendshipId);
    } catch (e) {
      console.error('[申請取消エラー]', e);
      setCancelError('取消に失敗しました。もう一度お試しください');
      setCancelling(false);
    }
  };

  // handle が null (プロフィール未設定ユーザー) の場合は "@null" にならないよう name にフォールバックする
  const targetLabel = request.handle ? `@${request.handle}` : request.name;

  const popupContent = (
    <>
      <Pressable onPress={handleCancel} disabled={cancelling}>
        <XStack alignItems="center" gap="$3" opacity={cancelling ? 0.5 : 1}>
          <Text color="#fff" fontSize={14} lineHeight={19} flex={1}>
            {cancelling ? '取消中…' : `${targetLabel} さんへの申請を取り消す`}
          </Text>
          <RemovePersonIcon color="#e74c3c" />
        </XStack>
      </Pressable>
      {cancelError ? (
        <Text color="#e74c3c" fontSize={12} marginTop="$2">
          {cancelError}
        </Text>
      ) : null}
    </>
  );

  return (
    <YStack position="relative">
      <XStack alignItems="center" gap="$3">
        <Pressable onPress={goToProfile} hitSlop={4} style={{ flex: 1 }}>
          <XStack alignItems="center" gap="$3">
            <Avatar initial={getAvatarInitial(request.name)} color={getAvatarColor(request.name)} size={44} />
            <YStack flex={1}>
              <Text color="#fff" fontSize={15} fontWeight="600">
                {request.name}
              </Text>
              <Text color="#555" fontSize={13}>
                @{request.handle}
              </Text>
              <Text color="#555" fontSize={12} marginTop={2}>
                {formatRequestedAt(request.requestedAt)}に申請
              </Text>
            </YStack>
          </XStack>
        </Pressable>
        <View ref={buttonRef} collapsable={false}>
          <Button onPress={openConfirm} disabled={cancelling} backgroundColor="#1a1a1a" borderRadius="$4" height={36} paddingHorizontal="$4">
            <Text color="#e74c3c" fontSize={13} fontWeight="700">
              取り消す
            </Text>
          </Button>
        </View>
      </XStack>

      {/* Modalはツリーの外(ルート)にポータルされるため、祖先のtransform等に影響されず
          画面全体を確実に覆える。外タップで閉じ、ポップアップ自体はボタンの計測座標付近に配置する */}
      {anchor ? (
        <Modal transparent visible animationType="fade" onRequestClose={closeConfirm}>
          <Pressable style={{ flex: 1 }} onPress={closeConfirm}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: anchor.top + anchor.height + 8,
                left: Math.min(Math.max(8, anchor.left + anchor.width - POPUP_WIDTH), Dimensions.get('window').width - POPUP_WIDTH - 8),
              }}
            >
              <YStack
                width={POPUP_WIDTH}
                backgroundColor="#1c1c1e"
                borderWidth={1}
                borderColor="#2a2a2a"
                borderRadius="$4"
                padding="$3"
                shadowColor="#000"
                shadowOpacity={0.5}
                shadowRadius={12}
                shadowOffset={{ width: 0, height: 4 }}
              >
                {popupContent}
              </YStack>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </YStack>
  );
}

function RemovePersonIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={9} cy={7} r={3.2} />
      <Path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <Path d="M17 8l4 4M21 8l-4 4" />
    </Svg>
  );
}

function formatRequestedAt(requestedAt: string): string {
  const diffMinutes = Math.floor((Date.now() - new Date(requestedAt).getTime()) / 60000);
  if (diffMinutes < 1) return 'たった今';
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}日前`;
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

// 本格実装はフレンド管理画面のIssueで行う
export default function SentFriendRequestsScreen() {
  return <PlaceholderScreen title="送信済み申請" />;
}
