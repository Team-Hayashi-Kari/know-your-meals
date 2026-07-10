import { Pressable } from 'react-native';
import { ScrollView, Text, XStack, YStack } from 'tamagui';
import type { NearbyPost } from '../../lib/mock-api';
import { Avatar } from '../post-flow/Avatar';
import { PinBadge } from '../post-flow/PinBadge';

type NearbyPostsSheetProps = {
  posts: NearbyPost[];
  onPressPost: (postId: string) => void;
};

// @gorhom/bottom-sheet 等のドラッグ式シートは使わず、固定高さのパネルとして実装（Web専用のため十分）
export function NearbyPostsSheet({ posts, onPressPost }: NearbyPostsSheetProps) {
  return (
    <YStack
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      height="45%"
      backgroundColor="#000"
      borderTopLeftRadius={20}
      borderTopRightRadius={20}
      borderWidth={1}
      borderColor="#1a1a1a"
      overflow="hidden"
    >
      {/* つまみ（見た目のみ、ドラッグ操作は無し） */}
      <YStack alignItems="center" paddingTop="$3" paddingBottom="$2">
        <YStack width={36} height={4} borderRadius={2} backgroundColor="#333" />
      </YStack>

      <XStack paddingHorizontal="$5" paddingBottom="$3">
        <Text color="#fff" fontSize={16} fontWeight="800">
          近くの投稿
        </Text>
      </XStack>

      <ScrollView flex={1} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 14 }}>
        {posts.length === 0 ? (
          <Text color="#555" fontSize={14} marginTop="$4">
            この条件に合う投稿はありません
          </Text>
        ) : (
          posts.map((post) => <NearbyPostCard key={post.id} post={post} onPress={() => onPressPost(post.id)} />)
        )}
      </ScrollView>
    </YStack>
  );
}

function NearbyPostCard({ post, onPress }: { post: NearbyPost; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <XStack alignItems="center" gap="$3">
        <PinBadge emoji={post.genreEmoji} size={40} />
        <YStack flex={1} gap="$0.5">
          <XStack alignItems="center" gap="$2">
            <Text color="#fff" fontSize={15} fontWeight="700" numberOfLines={1} flexShrink={1}>
              {post.storeName}
            </Text>
            <Text color="#555" fontSize={12}>
              {formatDistance(post.distanceMeters)}
            </Text>
          </XStack>
          <Text color="#888" fontSize={13} numberOfLines={1}>
            {post.comment}
          </Text>
        </YStack>
        <Avatar initial={post.userInitial} color={post.userColor} size={32} />
      </XStack>
    </Pressable>
  );
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) return `${distanceMeters}m`;
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}
