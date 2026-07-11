import type { SentFriendRequest } from '@repo/api-types';
import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
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

function RequestRow({ request, onCancelled }: { request: SentFriendRequest; onCancelled: (friendshipId: number) => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // ユーザー詳細画面(#76/#78)は未実装のため、実装済みになったタイミングでそのまま繋がるルートへ遷移させておく
  const goToProfile = () => {
    if (!request.handle) return;
    router.push(`/users/${request.handle}`);
  };

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

  return (
    <YStack>
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
        <Button
          onPress={() => setConfirming((prev) => !prev)}
          disabled={cancelling}
          backgroundColor="#1a1a1a"
          borderRadius="$4"
          height={36}
          paddingHorizontal="$4"
        >
          <Text color="#e74c3c" fontSize={13} fontWeight="700">
            取り消す
          </Text>
        </Button>
      </XStack>

      {confirming ? (
        <YStack marginTop="$2" backgroundColor="#151517" borderRadius="$4" padding="$3" gap="$3">
          <Text color="#ddd" fontSize={13}>
            申請を取り消しますか？
          </Text>
          {cancelError ? (
            <Text color="#e74c3c" fontSize={12}>
              {cancelError}
            </Text>
          ) : null}
          <XStack gap="$3">
            <Button onPress={handleCancel} disabled={cancelling} backgroundColor="#e74c3c" borderRadius="$4" height={36} paddingHorizontal="$4">
              <Text color="#fff" fontSize={13} fontWeight="700">
                {cancelling ? '取消中…' : '申請取り消し'}
              </Text>
            </Button>
            <Button onPress={() => setConfirming(false)} disabled={cancelling} backgroundColor="transparent" height={36} paddingHorizontal="$2">
              <Text color="#888" fontSize={13} fontWeight="600">
                やめる
              </Text>
            </Button>
          </XStack>
        </YStack>
      ) : null}
    </YStack>
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
}
