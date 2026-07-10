import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Spinner, Text, YStack } from 'tamagui';
import { ProfileView } from '../../components/profile/ProfileView';
import {
  getMe,
  getMyPosts,
  getMyProfileSummary,
  type MeProfile,
  type MyProfileSummary,
  type ProfileAlbumPost,
} from '../../lib/mock-api';

export default function MyProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [summary, setSummary] = useState<MyProfileSummary | null>(null);
  const [posts, setPosts] = useState<ProfileAlbumPost[]>([]);

  useEffect(() => {
    getMe().then(setProfile);
    getMyProfileSummary().then(setSummary);
    getMyPosts().then(setPosts);
  }, []);

  if (!profile || !summary) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center">
        <Spinner color="#555" />
      </YStack>
    );
  }

  return (
    <ProfileView
      avatarInitial={getAvatarInitial(profile.name)}
      avatarColor={getAvatarColor(profile.name)}
      name={profile.name || '未設定'}
      handle={profile.handle ?? ''}
      bio={profile.bio}
      postsCount={summary.postsCount}
      friendsCount={summary.friendsCount}
      posts={posts}
      // 設定（アカウント・通知・プライバシー）画面は今回のスコープ外のため未接続
      headerRight={
        <Text fontSize={20} color="#fff">
          ⚙
        </Text>
      }
      primaryAction={{
        label: 'プロフィールを編集',
        onPress: () => router.push('/profile/edit'),
        variant: 'outline',
      }}
      links={[
        { label: '受信した申請', badge: summary.pendingReceivedCount, onPress: () => router.push('/friend-requests/received') },
        { label: '送信済み申請', onPress: () => router.push('/friend-requests/sent') },
        { label: 'フレンド一覧', onPress: () => router.push('/friends') },
        { label: '保存した投稿', onPress: () => router.push('/bookmarks') },
      ]}
      onPostPress={(postId) => router.push(`/posts/${postId}`)}
    />
  );
}
