import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Button, Input, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';
import { getSuggestedUsers, searchUsers, sendFriendRequest, type UserSearchResult } from '../lib/mock-api';

export default function FindFriendsScreen() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [suggested, setSuggested] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  // 1人でも申請したかどうか
  const [hasRequested, setHasRequested] = useState(false);

  // 画面にフォーカスが戻るたび（他人プロフィールから戻ってきた時含む）に再取得し、relationshipStatusの古い表示を防ぐ
  useFocusEffect(
    useCallback(() => {
      getSuggestedUsers().then((users) => setSuggested(users));
      const trimmed = query.trim();
      if (trimmed) {
        searchUsers(trimmed).then((users) => setResults(users));
      }
    }, [query]),
  );

  // 検索欄が変わるたびに検索
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchUsers(query).then((users) => {
        setResults(users);
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

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

      {/* 検索中の見出し or おすすめの見出し */}
      {!isSearching && suggested.length > 0 && (
        <Text color="#888" fontSize={13} fontWeight="600" marginBottom="$3">
          おすすめのフレンド
        </Text>
      )}

      <YStack gap="$3">
        {loading ? (
          <Spinner color="#555" marginTop="$4" />
        ) : isSearching ? (
          // 検索中
          results.length > 0 ? (
            results.map((user) => <UserRow key={user.id} user={user} onRequested={() => setHasRequested(true)} />)
          ) : (
            <Text color="#888" fontSize={14} marginTop="$2">
              「{query.trim()}」の検索結果はありません
            </Text>
          )
        ) : (
          // 検索していないときはおすすめを表示
          suggested.map((user) => <UserRow key={user.id} user={user} onRequested={() => setHasRequested(true)} />)
        )}
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

function UserRow({ user, onRequested }: { user: UserSearchResult; onRequested: () => void }) {
  const [status, setStatus] = useState(user.relationshipStatus);
  const [sending, setSending] = useState(false);

  // フォーカス復帰時の再取得で prop が変わっても、同じ key の行は state を保持したままなので同期する
  useEffect(() => {
    setStatus(user.relationshipStatus);
  }, [user.relationshipStatus]);

  const handleSend = async () => {
    setSending(true);
    await sendFriendRequest(user.id);
    setStatus('pending_sent');
    setSending(false);
    onRequested();
  };

  const router = useRouter();

  return (
    <XStack alignItems="center" gap="$3">
      <XStack flex={1} alignItems="center" gap="$3" onPress={() => router.push(`/users/${user.handle}`)} pressStyle={{ opacity: 0.7 }}>
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
      </XStack>
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
