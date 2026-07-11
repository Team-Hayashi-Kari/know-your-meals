import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Spinner, Text, YStack } from 'tamagui';
import { ProfileView, type ProfileViewPost } from '../../components/profile/ProfileView';
import { ApiError, getMe, getMyFriends, getMyPosts, getMyReceivedFriendRequests, type MeProfile, toAbsoluteApiUrl } from '../../lib/profile-api';

type Summary = {
  postsCount: number;
  friendsCount: number;
  pendingReceivedCount: number;
};

export default function MyProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [posts, setPosts] = useState<ProfileViewPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    // ponytail: /api/me/summary は無いので、既存3本のAPIを1回のPromise.allで叩いて件数をここで組み立てる
    Promise.all([getMe(), getMyPosts(), getMyFriends(), getMyReceivedFriendRequests()])
      .then(([me, myPosts, friends, received]) => {
        if (!me.handle) {
          router.replace('/profile-setup');
          return;
        }
        setProfile(me);
        setSummary({ postsCount: myPosts.length, friendsCount: friends.length, pendingReceivedCount: received.length });
        setPosts(
          myPosts.map((post) => ({
            id: String(post.id),
            imageUri: post.imageUrl ? toAbsoluteApiUrl(post.imageUrl) : null,
          })),
        );
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          router.replace('/');
          return;
        }
        setError('プロフィールを読み込めませんでした');
      });
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center" gap="$3" paddingHorizontal="$6">
        <Text color="#fff" fontSize={15} textAlign="center">
          {error}
        </Text>
      </YStack>
    );
  }

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
