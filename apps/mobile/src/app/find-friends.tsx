import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Input, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';
import { ApiError, searchUsers, sendFriendRequest, type UserSearchResult } from '../lib/api';

export default function FindFriendsScreen() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  // 1人でも申請したかどうか
  const [hasRequested, setHasRequested] = useState(false);

  // 検索欄が変わるたびに検索
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchUsers(trimmed)
        .then((users) => setResults(users))
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) {
            router.replace('/');
            return;
          }
          console.error('[FindFriendsScreen] search failed', e);
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, router]);

  const isSearching = query.trim() !== '';

  return (
    <ScrollView
      flex={1}
      backgroundColor="#000"
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 64,
        paddingBottom: 32,
      }}
    >
      <XStack marginBottom="$6">
        <Text color="#555" fontSize={13} fontWeight="600">
          ステップ 2 / 2
        </Text>
      </XStack>

      <Text color="#fff" fontSize={32} fontWeight="800" lineHeight={38} marginBottom="$2">
        フレンドを{'\n'}見つけよう
      </Text>
      <Text color="#555" fontSize={14} marginBottom="$5">
        IDや名前で検索してフレンド申請。
      </Text>

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="IDまたは名前で検索"
        placeholderTextColor="$gray9"
        backgroundColor="#1a1a1a"
        borderWidth={0}
        color="#fff"
        height={52}
        fontSize={16}
        borderRadius="$4"
        autoCapitalize="none"
        marginBottom="$4"
      />

      <YStack gap="$3">
        {loading ? (
          <Spinner color="#555" marginTop="$4" />
        ) : isSearching ? (
          results.length > 0 ? (
            results.map((user) => <UserRow key={user.id} user={user} onRequested={() => setHasRequested(true)} />)
          ) : (
            <Text color="#888" fontSize={14} marginTop="$2">
              「{query.trim()}」の検索結果はありません
            </Text>
          )
        ) : null}
      </YStack>

      <Button
        onPress={() => router.replace('/home')}
        backgroundColor="#fff"
        pressStyle={{ backgroundColor: '#e8e8e8', scale: 0.97 }}
        borderRadius="$5"
        height={60}
        marginTop="$6"
      >
        <Text color="#000" fontWeight="700" fontSize={16}>
          {hasRequested ? 'はじめる' : 'スキップしてはじめる'}
        </Text>
      </Button>
    </ScrollView>
  );
}

const STATUS_LABEL: Record<Exclude<UserSearchResult['relationshipStatus'], 'none'>, string> = {
  pending_sent: '申請中',
  pending_received: '承認待ち',
  friends: 'フレンド',
};

function UserRow({ user, onRequested }: { user: UserSearchResult; onRequested: () => void }) {
  const [status, setStatus] = useState(user.relationshipStatus);
  const [sending, setSending] = useState(false);
  const router = useRouter();

  const handleSend = async () => {
    setSending(true);
    try {
      await sendFriendRequest(user.id);
      setStatus('pending_sent');
      onRequested();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace('/');
        return;
      }
      // 409 (申請済みなどの競合) を含め、失敗時は申請済み扱いにして表示を同期する
      console.error('[UserRow] sendFriendRequest failed', e);
      setStatus('pending_sent');
    } finally {
      setSending(false);
    }
  };

  return (
    <XStack alignItems="center" gap="$3">
      <YStack width={44} height={44} borderRadius={22} backgroundColor={getAvatarColor(user.name)} justifyContent="center" alignItems="center">
        <Text color="#fff" fontSize={18} fontWeight="700">
          {getAvatarInitial(user.name)}
        </Text>
      </YStack>
      <YStack flex={1}>
        <Text color="#fff" fontSize={15} fontWeight="600">
          {user.name}
        </Text>
        <Text color="#555" fontSize={13}>
          @{user.handle}
        </Text>
      </YStack>
      {status === 'pending_sent' ? (
        <Text color="#555" fontSize={13} fontWeight="600">
          申請中
        </Text>
      ) : status === 'none' ? (
        <Button onPress={handleSend} disabled={sending} backgroundColor="#1a1a1a" borderRadius="$4" height={36} paddingHorizontal="$4">
          <Text color="#ffd400" fontSize={13} fontWeight="700">
            申請する
          </Text>
        </Button>
      ) : (
        <Text color="#555" fontSize={13} fontWeight="600">
          {STATUS_LABEL[status]}
        </Text>
      )}
    </XStack>
  );
}
