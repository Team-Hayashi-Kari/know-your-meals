import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { Avatar } from '../post-flow/Avatar';

type ProfileMenuProps = {
  visible: boolean;
  onClose: () => void;
  userInitial: string;
  name: string;
  handle: string | null;
  receivedRequestCount: number;
};

const PANEL_WIDTH = 280;

// Web専用のため、react-native-reanimated等は使わずCSSトランジションで開閉する（NearbyPostsSheetと同じ方針）
export function ProfileMenu({ visible, onClose, userInitial, name, handle, receivedRequestCount }: ProfileMenuProps) {
  const router = useRouter();

  const goTo = (path: string) => {
    onClose();
    router.push(path);
  };

  return (
    <>
      <YStack
        role="button"
        aria-label="メニューを閉じる"
        onPress={onClose}
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        zIndex={40}
        backgroundColor="rgba(0,0,0,0.5)"
        pointerEvents={visible ? 'auto' : 'none'}
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
      />
      <YStack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        width={PANEL_WIDTH}
        zIndex={41}
        backgroundColor="#111"
        borderLeftWidth={1}
        borderLeftColor="#222"
        paddingTop={64}
        paddingHorizontal="$4"
        pointerEvents={visible ? 'auto' : 'none'}
        style={{
          transition: 'transform 0.25s ease',
          transform: visible ? 'translateX(0)' : `translateX(${PANEL_WIDTH}px)`,
        }}
      >
        <XStack alignItems="center" gap="$3" paddingBottom="$4" borderBottomWidth={1} borderBottomColor="#222" marginBottom="$3">
          <Avatar initial={userInitial} size={48} />
          <YStack>
            <Text color="#fff" fontSize={16} fontWeight="700">
              {name}
            </Text>
            {handle ? (
              <Text color="#888" fontSize={13}>
                @{handle}
              </Text>
            ) : null}
          </YStack>
        </XStack>

        <MenuItem label="プロフィール編集" onPress={() => goTo('/profile-edit')} />
        <MenuItem label="フレンド一覧" onPress={() => goTo('/home/friends')} />
        <MenuItem label="フレンド検索・申請" onPress={() => goTo('/find-friends')} />
        <MenuItem label="届いた申請" badge={receivedRequestCount} onPress={() => goTo('/friend-requests')} />
      </YStack>
    </>
  );
}

function MenuItem({ label, onPress, badge }: { label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <XStack alignItems="center" justifyContent="space-between" paddingVertical="$3">
        <Text color="#fff" fontSize={15} fontWeight="600">
          {label}
        </Text>
        {badge ? (
          <Text color="#888" fontSize={13} fontWeight="600">
            {badge}
          </Text>
        ) : null}
      </XStack>
    </Pressable>
  );
}
