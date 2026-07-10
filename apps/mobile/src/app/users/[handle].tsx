import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, ScrollView, Spinner, Text, YStack } from 'tamagui';
import { ProfileView } from '../../components/profile/ProfileView';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getUserPosts,
  getUserProfile,
  type NearbyPost,
  type RelationshipStatus,
  sendFriendRequest,
  type UserProfile,
} from '../../lib/mock-api';

export default function UserProfileScreen() {
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();

  const [profile, setProfile] = useState<UserProfile | undefined>(undefined);
  const [posts, setPosts] = useState<NearbyPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([getUserProfile(handle), getUserPosts(handle)]).then(([p, userPosts]) => {
      setProfile(p);
      setPosts(userPosts);
      setLoading(false);
    });
  }, [handle]);

  const updateStatus = (relationshipStatus: RelationshipStatus) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const gainedFriend = relationshipStatus === 'friends' && prev.relationshipStatus !== 'friends';
      return { ...prev, relationshipStatus, friendCount: gainedFriend ? prev.friendCount + 1 : prev.friendCount };
    });
  };

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
        actions={<FriendCta userId={profile.id} status={profile.relationshipStatus} onChange={updateStatus} />}
      />
    </ScrollView>
  );
}

function FriendCta({ userId, status, onChange }: { userId: string; status: RelationshipStatus; onChange: (status: RelationshipStatus) => void }) {
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, next: RelationshipStatus) => {
    setBusy(true);
    await action();
    onChange(next);
    setBusy(false);
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
        onPress={() => run(() => acceptFriendRequest(userId), 'friends')}
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
      <Button onPress={() => run(() => cancelFriendRequest(userId), 'none')} disabled={busy} backgroundColor="#1a1a1a" borderRadius="$4" height={44}>
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
    <Button onPress={() => run(() => sendFriendRequest(userId), 'pending_sent')} disabled={busy} backgroundColor="#fff" borderRadius="$4" height={44}>
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
