import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, Spinner, Text, YStack } from 'tamagui';
import { ProfileView } from '../../components/profile/ProfileView';
import {
  ApiError,
  acceptFriendRequest,
  cancelFriendRequest,
  getUserPosts,
  getUserProfile,
  type ProfilePost,
  type RelationshipStatus,
  sendFriendRequest,
  type UserProfile,
} from '../../lib/api';

export default function UserProfileScreen() {
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();

  const [profile, setProfile] = useState<UserProfile | undefined>(undefined);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!handle) return;
    try {
      const p = await getUserProfile(handle);
      if (!p) {
        setProfile(undefined);
        setPosts([]);
        return;
      }
      setProfile(p);
      try {
        setPosts(await getUserPosts(handle));
      } catch (e) {
        // 非フレンドは投稿一覧が404になる仕様（apps/api/src/routes/users.ts）。プロフィール自体は表示する
        if (e instanceof ApiError && e.status === 404) {
          setPosts([]);
        } else {
          throw e;
        }
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace('/');
        return;
      }
      // 404以外の予期しないエラーはログに残しつつ、not found 表示にフォールバックする
      console.error('[UserProfileScreen] load failed', e);
      setProfile(undefined);
      setPosts([]);
    }
  }, [handle, router]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center">
        <Spinner color="#555" />
      </YStack>
    );
  }

  if (!profile) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center" paddingHorizontal="$6">
        <Text color="#fff" fontSize={16} fontWeight="600" marginBottom="$4">
          ユーザーが見つかりません
        </Text>
        <Button onPress={() => router.back()} backgroundColor="#1a1a1a" borderRadius="$4" height={44} paddingHorizontal="$5">
          <Text color="#ffd400" fontWeight="600">
            戻る
          </Text>
        </Button>
      </YStack>
    );
  }

  return (
    <ScrollView
      flex={1}
      backgroundColor="#000"
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 64,
        paddingBottom: 32,
      }}
    >
      <Button onPress={() => router.back()} alignSelf="flex-start" backgroundColor="transparent" padding={0} height={32} marginBottom="$4">
        <Text color="#888" fontSize={14}>
          ← 戻る
        </Text>
      </Button>

      <ProfileView
        profile={profile}
        posts={posts}
        actions={<FriendCta userId={profile.id} friendshipId={profile.friendshipId} status={profile.relationshipStatus} onChange={load} />}
      />
    </ScrollView>
  );
}

function FriendCta({
  userId,
  friendshipId,
  status,
  onChange,
}: {
  userId: string;
  friendshipId: number | null;
  status: RelationshipStatus;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      // 409 (競合) はプロフィール再取得で状態を同期する。それ以外はログに残す
      if (!(e instanceof ApiError && e.status === 409)) {
        console.error('[FriendCta] action failed', e);
      }
    } finally {
      await onChange();
      setBusy(false);
    }
  };

  if (status === 'friends') {
    return (
      <YStack backgroundColor="#1a1a1a" borderRadius="$4" height={44} justifyContent="center" alignItems="center">
        <Text color="#ffd400" fontWeight="700" fontSize={14}>
          フレンド ✓
        </Text>
      </YStack>
    );
  }

  if (status === 'pending_received') {
    return (
      <Button
        onPress={() => friendshipId !== null && run(() => acceptFriendRequest(friendshipId))}
        disabled={busy}
        backgroundColor="#ffd400"
        borderRadius="$4"
        height={44}
      >
        {busy ? (
          <Spinner color="#000" />
        ) : (
          <Text color="#000" fontWeight="700" fontSize={14}>
            承認する
          </Text>
        )}
      </Button>
    );
  }

  if (status === 'pending_sent') {
    return (
      <Button
        onPress={() => friendshipId !== null && run(() => cancelFriendRequest(friendshipId))}
        disabled={busy}
        backgroundColor="#1a1a1a"
        borderRadius="$4"
        height={44}
      >
        {busy ? (
          <Spinner color="#ffd400" />
        ) : (
          <Text color="#ffd400" fontWeight="700" fontSize={14}>
            申請済み・取消す
          </Text>
        )}
      </Button>
    );
  }

  return (
    <Button onPress={() => run(() => sendFriendRequest(userId))} disabled={busy} backgroundColor="#fff" borderRadius="$4" height={44}>
      {busy ? (
        <Spinner color="#000" />
      ) : (
        <Text color="#000" fontWeight="700" fontSize={14}>
          フレンド申請する
        </Text>
      )}
    </Button>
  );
}
