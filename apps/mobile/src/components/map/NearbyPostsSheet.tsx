import { useRef, useState } from 'react';
import { Pressable, useWindowDimensions } from 'react-native';
import { ScrollView, type TamaguiElement, Text, XStack, YStack } from 'tamagui';
import type { NearbyPost } from '../../lib/mock-api';
import { Avatar } from '../post-flow/Avatar';
import { PinBadge } from '../post-flow/PinBadge';

type NearbyPostsSheetProps = {
  posts: NearbyPost[];
  onPressPost: (postId: string) => void;
};

// つまみをドラッグして高さを変えられる下部シート。Web専用のため、
// @gorhom/bottom-sheet 等のネイティブジェスチャー前提のライブラリは使わず、
// ブラウザのポインターイベントで実装している。
export function NearbyPostsSheet({ posts, onPressPost }: NearbyPostsSheetProps) {
  const { height: windowHeight } = useWindowDimensions();

  const collapsedHeight = 120;
  const halfHeight = windowHeight * 0.45;
  const fullHeight = windowHeight * 0.85;
  const snapPoints = [collapsedHeight, halfHeight, fullHeight];

  const [sheetHeight, setSheetHeight] = useState(halfHeight);
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null);
  const currentHeight = useRef(halfHeight);
  const sheetRef = useRef<TamaguiElement>(null);

  // ドラッグ中に毎回setState→再描画（下の投稿リストの再計算も含む）を挟むとカクつくため、
  // ドラッグ中はDOM要素のstyle.heightを直接書き換え、Reactの状態更新は指を離した瞬間(スナップ)だけ行う
  const handlePointerDown = (e: { clientY: number }) => {
    dragState.current = { startY: e.clientY, startHeight: currentHeight.current };

    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      if (!dragState.current) return;
      // シートの端を指/カーソルの位置に正確に一致させるため、移動量は等倍(1:1)で反映する
      const delta = dragState.current.startY - moveEvent.clientY;
      const next = Math.min(fullHeight, Math.max(collapsedHeight, dragState.current.startHeight + delta));
      currentHeight.current = next;
      // Web専用のため、TamaguiElement(型定義上はネイティブViewとの共用)をHTMLElementとして扱ってよい
      const node = sheetRef.current as HTMLElement | null;
      if (node) node.style.height = `${next}px`;
    };

    const handleWindowPointerUp = () => {
      dragState.current = null;
      const nearest = snapPoints.reduce((closest, point) =>
        Math.abs(point - currentHeight.current) < Math.abs(closest - currentHeight.current) ? point : closest,
      );
      currentHeight.current = nearest;
      setSheetHeight(nearest);
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
  };

  return (
    <YStack
      ref={sheetRef}
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      zIndex={10}
      height={sheetHeight}
      backgroundColor="#000"
      borderTopLeftRadius={20}
      borderTopRightRadius={20}
      borderWidth={1}
      borderColor="#1a1a1a"
      overflow="hidden"
    >
      <YStack alignItems="center" paddingTop="$3" paddingBottom="$2" cursor="grab" onPointerDown={handlePointerDown} style={{ touchAction: 'none' }}>
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
