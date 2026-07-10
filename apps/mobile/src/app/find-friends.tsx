import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Input, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';
import { searchUsers, sendFriendRequest, type UserSearchResult } from '../lib/mock-api';

export default function FindFriendsScreen() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchUsers(query).then((users) => {
      setResults(users);
      setLoading(false);
    });
  }, [query]);

  return (
    <YStack flex={1} backgroundColor="#000">
      {/* スクロールする中身（ボタンの高さぶん下に余白をあける） */}
      <ScrollView
        flex={1}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 64,
          paddingBottom: 120,
        }}
      >
        {/* 上部：ステップ表示 と スキップ */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
          <Text color="#555" fontSize={13} fontWeight="600">
            ステップ 2 / 2
          </Text>
          <Text color="#555" fontSize={13} fontWeight="600" onPress={() => router.replace('/home')}>
            スキップ
          </Text>
        </XStack>

        {/* 見出し */}
        <Text color="#fff" fontSize={32} fontWeight="800" lineHeight={38} marginBottom="$2">
          フレンドを{'\n'}見つけよう
        </Text>
        <Text color="#555" fontSize={14} marginBottom="$5">
          IDや名前で検索してフレンド申請。
        </Text>

        {/* 検索欄 */}
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

        {/* 検索結果 */}
        <YStack gap="$3">{loading ? <Spinner color="#555" marginTop="$4" /> : results.map((user) => <UserRow key={user.id} user={user} />)}</YStack>
      </ScrollView>

      {/* 画面の底に固定する「はじめる」ボタン */}
      <YStack position="absolute" bottom={0} left={0} right={0} backgroundColor="#000" paddingHorizontal="$6" paddingBottom="$8" paddingTop="$3">
        <Button
          onPress={() => router.replace('/home')}
          backgroundColor="#fff"
          pressStyle={{ backgroundColor: '#e8e8e8', scale: 0.97 }}
          borderRadius="$5"
          height={60}
        >
          <Text color="#000" fontWeight="700" fontSize={16}>
            はじめる
          </Text>
        </Button>
      </YStack>
    </YStack>
  );
}

// ===== ユーザー1人分の行 =====
function UserRow({ user }: { user: UserSearchResult }) {
  const [status, setStatus] = useState(user.relationshipStatus);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await sendFriendRequest(user.id);
    setStatus('pending_sent');
    setSending(false);
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
      ) : (
        <Button onPress={handleSend} disabled={sending} backgroundColor="#1a1a1a" borderRadius="$4" height={36} paddingHorizontal="$4">
          <Text color="#ffd400" fontSize={13} fontWeight="700">
            申請する
          </Text>
        </Button>
      )}
    </XStack>
  );
}
