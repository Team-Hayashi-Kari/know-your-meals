import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { ScrollView, Text, XStack, YStack } from 'tamagui';
import { Avatar } from '../post-flow/Avatar';
import { PhotoSlot } from '../post-flow/PhotoSlot';

export type ProfileViewPost = {
  id: string;
  imageUri: string | null;
};

export type ProfileLink = {
  label: string;
  badge?: number;
  onPress: () => void;
};

export type ProfilePrimaryAction = {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outline';
};

type ProfileViewProps = {
  avatarInitial: string;
  avatarColor?: string;
  name: string;
  handle: string;
  bio: string | null;
  postsCount: number;
  friendsCount: number;
  posts: ProfileViewPost[];
  // 他人プロフィール（FE-16）でのみ戻る導線を表示。自分プロフィールはタブのルートのため省略。
  onBack?: () => void;
  // 自分: 設定歯車 / 他人: "..."メニューなど、右上アクションは呼び出し側で差し替える。
  headerRight?: ReactNode;
  // 自分プロフィール向けのメインCTA。
  primaryAction?: ProfilePrimaryAction;
  // 他人プロフィール向けなど、relationshipStatus 別CTAを呼び出し側で組み立てたい場合に使う。
  actions?: ReactNode;
  // 自分プロフィールのみ表示する導線チップ（受信した申請・フレンド一覧など）。他人プロフィールでは省略可。
  links?: ProfileLink[];
  onPostPress?: (postId: string) => void;
};

export function ProfileView({
  avatarInitial,
  avatarColor = '#e8b04b',
  name,
  handle,
  bio,
  postsCount,
  friendsCount,
  posts,
  onBack,
  headerRight,
  primaryAction,
  actions,
  links = [],
  onPostPress,
}: ProfileViewProps) {
  return (
    <ScrollView
      flex={1}
      backgroundColor="#000"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: onBack ? 12 : 64,
        paddingBottom: 48,
      }}
    >
      <XStack justifyContent={onBack ? 'space-between' : 'flex-end'} alignItems="center" minHeight={32} marginBottom="$5">
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="戻る">
            <Text fontSize={22} color="#fff">
              ←
            </Text>
          </Pressable>
        ) : null}
        {headerRight}
      </XStack>

      <XStack alignItems="center" gap="$5" marginBottom="$4">
        <Avatar initial={avatarInitial} color={avatarColor} size={80} />
        <XStack flex={1} justifyContent="space-around">
          <YStack alignItems="center">
            <Text color="#fff" fontSize={20} fontWeight="800">
              {postsCount}
            </Text>
            <Text color="#888" fontSize={13}>
              投稿
            </Text>
          </YStack>
          <YStack alignItems="center">
            <Text color="#fff" fontSize={20} fontWeight="800">
              {friendsCount}
            </Text>
            <Text color="#888" fontSize={13}>
              フレンド
            </Text>
          </YStack>
        </XStack>
      </XStack>

      <YStack gap="$1" marginBottom="$4">
        <Text color="#fff" fontSize={19} fontWeight="800">
          {name}
        </Text>
        <Text color="#888" fontSize={14}>
          @{handle}
        </Text>
        {bio ? (
          <Text color="#ccc" fontSize={14} lineHeight={20} marginTop="$1">
            {bio}
          </Text>
        ) : null}
      </YStack>

      {primaryAction ? (
        <Pressable onPress={primaryAction.onPress}>
          <YStack
            height={52}
            borderRadius="$5"
            justifyContent="center"
            alignItems="center"
            marginBottom={links.length > 0 ? '$4' : '$6'}
            backgroundColor={primaryAction.variant === 'filled' ? '#fff' : '#1a1a1a'}
            borderWidth={primaryAction.variant === 'filled' ? 0 : 1}
            borderColor="#333"
          >
            <Text color={primaryAction.variant === 'filled' ? '#000' : '#fff'} fontSize={15} fontWeight="700">
              {primaryAction.label}
            </Text>
          </YStack>
        </Pressable>
      ) : null}

      {actions ? <YStack marginBottom="$6">{actions}</YStack> : null}

      {links.length > 0 ? (
        <XStack flexWrap="wrap" gap="$3" marginBottom="$6">
          {links.map((link) => (
            <Pressable key={link.label} onPress={link.onPress} style={{ flexBasis: '47%', flexGrow: 1 }}>
              <XStack height={44} borderRadius="$4" backgroundColor="#1a1a1a" justifyContent="center" alignItems="center" gap="$2">
                <Text color="#fff" fontSize={14} fontWeight="600">
                  {link.label}
                </Text>
                {link.badge ? (
                  <YStack width={18} height={18} borderRadius={9} backgroundColor="#ffd400" justifyContent="center" alignItems="center">
                    <Text color="#000" fontSize={11} fontWeight="800">
                      {link.badge}
                    </Text>
                  </YStack>
                ) : null}
              </XStack>
            </Pressable>
          ))}
        </XStack>
      ) : null}

      <Text color="#888" fontSize={13} fontWeight="600" marginBottom="$3">
        投稿（アルバム）
      </Text>
      <XStack flexWrap="wrap" gap="$2">
        {posts.map((post) => (
          <Pressable key={post.id} onPress={() => onPostPress?.(post.id)} style={{ width: '32%' }}>
            <PhotoSlot uri={post.imageUri} width="100%" height={110} borderRadius={8} label="Drop an image" />
          </Pressable>
        ))}
      </XStack>
    </ScrollView>
  );
}
