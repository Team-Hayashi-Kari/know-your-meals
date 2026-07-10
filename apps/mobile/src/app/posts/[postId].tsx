import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';
import { Avatar } from '../../components/post-flow/Avatar';
import { MiniHeader } from '../../components/post-flow/MiniHeader';
import { PhotoSlot } from '../../components/post-flow/PhotoSlot';
import { PrimaryButton } from '../../components/post-flow/PrimaryButton';
import { SecondaryButton } from '../../components/post-flow/SecondaryButton';
import { deletePost, getPostById, toggleBookmark, type NearbyPost } from '../../lib/mock-api';

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const [post, setPost] = useState<NearbyPost | null | undefined>(undefined);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!postId) return;
    getPostById(postId).then((result) => {
      setPost(result ?? null);
      if (result) setIsBookmarked(result.isBookmarked);
    });
  }, [postId]);

  const handleToggleBookmark = async () => {
    if (!post) return;
    setSaving(true);
    await toggleBookmark(post.id);
    setIsBookmarked((prev) => !prev);
    setSaving(false);
  };

  const handleDeletePost = async () => {
    if (!post) return;
    await deletePost(post.id);
    router.back();
  };

  const handleOpenMenu = () => {
    if (!post) return;
    Alert.alert(
      '投稿メニュー',
      undefined,
      post.isMine
        ? [
            { text: '削除する', style: 'destructive', onPress: handleDeletePost },
            { text: 'キャンセル', style: 'cancel' },
          ]
        : [{ text: '閉じる', style: 'cancel' }],
    );
  };

  if (post === undefined) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center">
        <Spinner color="#555" />
      </YStack>
    );
  }

  if (post === null) {
    return (
      <YStack flex={1} backgroundColor="#000">
        <MiniHeader onBack={() => router.back()} />
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Text color="#555" fontSize={14}>
            投稿が見つかりませんでした
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="#000">
      <MiniHeader
        onBack={() => router.back()}
        rightAction={
          <Pressable onPress={handleOpenMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="メニュー">
            <Text fontSize={22} color="#fff">
              ⋯
            </Text>
          </Pressable>
        }
      />

      <ScrollView flex={1} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* ヒーロー写真 */}
        <YStack paddingHorizontal="$5" marginBottom="$4">
          <PhotoSlot uri={post.imageUri} height={280} borderRadius={16} label="写真なし" />
        </YStack>

        <YStack paddingHorizontal="$5" gap="$4">
          {/* 店名・カテゴリ・距離 */}
          <YStack gap="$1">
            <Text color="#fff" fontSize={22} fontWeight="800">
              {post.storeName}
            </Text>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={15}>{post.genreEmoji}</Text>
              <Text color="#555" fontSize={13}>
                {formatDistance(post.distanceMeters)}
              </Text>
            </XStack>
          </YStack>

          {/* 投稿者・投稿時刻 */}
          <XStack alignItems="center" gap="$3">
            <Avatar initial={post.userInitial} color={post.userColor} size={40} />
            <YStack>
              <Text color="#fff" fontSize={15} fontWeight="600">
                {post.userName}
              </Text>
              <Text color="#555" fontSize={13}>
                {formatRelativeTime(post.postedAt)}
              </Text>
            </YStack>
          </XStack>

          {/* コメント */}
          <Text color="#ddd" fontSize={15} lineHeight={22}>
            {post.comment}
          </Text>
        </YStack>
      </ScrollView>

      {/* 保存する（トグル：未保存はアウトライン、保存済みは塗りつぶし） */}
      <YStack position="absolute" bottom={0} left={0} right={0} backgroundColor="#000" paddingHorizontal="$6" paddingBottom="$8" paddingTop="$3">
        {isBookmarked ? (
          <PrimaryButton label="保存済み" onPress={handleToggleBookmark} disabled={saving} />
        ) : (
          <SecondaryButton label="保存する" onPress={handleToggleBookmark} disabled={saving} />
        )}
      </YStack>
    </YStack>
  );
}

// ===== 道具（関数） =====
function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) return `${distanceMeters}m`;
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function formatRelativeTime(postedAt: string): string {
  const diffMinutes = Math.floor((Date.now() - new Date(postedAt).getTime()) / 60000);
  if (diffMinutes < 1) return 'たった今';
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}日前`;
}
