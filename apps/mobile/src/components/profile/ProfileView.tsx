import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import type { ReactNode } from 'react';
import { Image as RNImage } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import type { ProfilePost } from '../../lib/api';

const GRID_GAP = 2;

export type ProfileViewData = {
  name: string;
  handle: string;
  image: string | null;
  bio: string | null;
  postCount: number;
  friendCount: number;
};

type ProfileViewProps = {
  profile: ProfileViewData;
  posts: ProfilePost[];
  // 右上または自己紹介下に置くアクション領域。自分プロフィールなら「編集」、他人プロフィールなら relationshipStatus 別 CTA
  actions?: ReactNode;
};

export function ProfileView({ profile, posts, actions }: ProfileViewProps) {
  return (
    <YStack>
      <XStack alignItems="center" gap="$4" marginBottom="$4">
        <YStack
          width={88}
          height={88}
          borderRadius={44}
          backgroundColor={profile.image ? '#1a1a1a' : getAvatarColor(profile.name)}
          justifyContent="center"
          alignItems="center"
          overflow="hidden"
        >
          {profile.image ? (
            <RNImage source={{ uri: profile.image }} style={{ width: 88, height: 88 }} resizeMode="cover" />
          ) : (
            <Text color="#fff" fontSize={36} fontWeight="700">
              {getAvatarInitial(profile.name)}
            </Text>
          )}
        </YStack>

        <XStack flex={1} justifyContent="space-around">
          <YStack alignItems="center">
            <Text color="#fff" fontSize={18} fontWeight="700">
              {profile.postCount}
            </Text>
            <Text color="#888" fontSize={12}>
              投稿
            </Text>
          </YStack>
          <YStack alignItems="center">
            <Text color="#fff" fontSize={18} fontWeight="700">
              {profile.friendCount}
            </Text>
            <Text color="#888" fontSize={12}>
              フレンド
            </Text>
          </YStack>
        </XStack>
      </XStack>

      <Text color="#fff" fontSize={20} fontWeight="700" marginBottom="$1">
        {profile.name}
      </Text>
      <Text color="#555" fontSize={14} marginBottom="$2">
        @{profile.handle}
      </Text>
      {profile.bio !== null && profile.bio !== '' && (
        <Text color="#ccc" fontSize={14} lineHeight={20} marginBottom="$3">
          {profile.bio}
        </Text>
      )}

      {actions !== undefined && <YStack marginBottom="$5">{actions}</YStack>}

      <XStack flexWrap="wrap" gap={GRID_GAP} marginTop="$2">
        {posts.map((post) => (
          <YStack key={post.id} width="32.5%" aspectRatio={1} backgroundColor="#1a1a1a" justifyContent="center" alignItems="center">
            <Text fontSize={28}>{post.pin}</Text>
          </YStack>
        ))}
      </XStack>

      {posts.length === 0 && (
        <Text color="#555" fontSize={14} textAlign="center" marginTop="$6">
          まだ投稿がありません
        </Text>
      )}
    </YStack>
  );
}
