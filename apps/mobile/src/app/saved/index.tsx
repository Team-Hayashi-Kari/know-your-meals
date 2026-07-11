import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Spinner, Text, YStack } from 'tamagui';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { PhotoSlot } from '../../components/post-flow/PhotoSlot';
import { PinBadge } from '../../components/post-flow/PinBadge';
import { type BookmarkedPost, getBookmarkedPosts } from '../../lib/mock-api';

export default function SavedScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const [posts, setPosts] = useState<BookmarkedPost[] | null>(null);

  const loadPosts = useCallback(() => {
    getBookmarkedPosts().then(setPosts);
  }, []);

  // 投稿詳細から保存解除・削除して戻ってきたときに一覧を再取得する
  // （@react-navigation/native は本プロジェクトに未導入のため useFocusEffect は使わず、
  //   このタブに戻るたびに変化する pathname を依存値にして代替している）
  useEffect(() => {
    if (pathname === '/saved') loadPosts();
  }, [pathname, loadPosts]);

  const goToPostDetail = (postId: string) => {
    router.push(`/posts/${postId}`);
  };

  return (
    <YStack flex={1} backgroundColor="#000">
      <YStack paddingHorizontal="$5" paddingTop="$6" paddingBottom="$4" gap="$1">
        <Text color="#fff" fontSize={28} fontWeight="800">
          保存済み
        </Text>
        <Text color="#777" fontSize={13}>
          あとで見返したい投稿
        </Text>
      </YStack>

      {posts === null ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner color="#555" />
        </YStack>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, flexGrow: 1 }}
          renderItem={({ item }) => <SavedPostTile post={item} onPress={() => goToPostDetail(item.id)} />}
          ListEmptyComponent={
            <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$6" gap="$2">
              <Text color="#fff" fontSize={17} fontWeight="700">
                保存した投稿はまだありません
              </Text>
              <Text color="#666" fontSize={13} textAlign="center" lineHeight={20}>
                投稿詳細の「保存する」から、気になるごはんをここに集められます
              </Text>
            </YStack>
          }
        />
      )}

      <BottomTabBar />
    </YStack>
  );
}

function SavedPostTile({ post, onPress }: { post: BookmarkedPost; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${post.storeName}の投稿を開く`} style={{ width: '47.5%' }}>
      <YStack gap="$2" marginBottom="$4">
        <YStack aspectRatio={1} borderRadius={8} overflow="hidden" position="relative" backgroundColor="#111">
          <PhotoSlot uri={post.imageUri} borderRadius={8} label={post.genreEmoji} />
          <YStack position="absolute" top={8} left={8}>
            <PinBadge emoji={post.genreEmoji} size={34} />
          </YStack>
        </YStack>

        <YStack gap={2}>
          <Text color="#fff" fontSize={14} fontWeight="700" numberOfLines={1}>
            {post.storeName}
          </Text>
          <Text color="#777" fontSize={12} numberOfLines={1}>
            {post.userName} ・ {formatRelativeTime(post.postedAt)}
          </Text>
          <Text color="#aaa" fontSize={12} numberOfLines={2} lineHeight={17}>
            {post.comment}
          </Text>
        </YStack>
      </YStack>
    </Pressable>
  );
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
