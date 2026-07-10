import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';
import { type FriendUser, getFriends } from '../../lib/mock-api';

export default function FriendsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFriends()
      .then((users) => setFriends(users))
      .catch(() => setError('フレンド一覧の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  const filteredFriends = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase().replace('@', '');
    if (!normalizedQuery) return friends;
    return friends.filter((friend) => {
      const handle = (friend.handle ?? '').toLowerCase();
      return friend.name.toLowerCase().includes(normalizedQuery) || handle.includes(normalizedQuery);
    });
  }, [friends, query]);

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
      <Text color="#fff" fontSize={32} fontWeight="800" lineHeight={38} marginBottom="$2">
        フレンド一覧
      </Text>
      <Text color="#555" fontSize={14} marginBottom="$5">
        名前またはIDで検索
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
        ) : error ? (
          <Text color="#888" fontSize={14} marginTop="$2">
            {error}
          </Text>
        ) : filteredFriends.length > 0 ? (
          filteredFriends.map((friend) => (
            <Button
              key={friend.id}
              unstyled
              onPress={() => router.push(`/users/${encodeURIComponent(friend.handle ?? friend.id)}`)}
              pressStyle={{ opacity: 0.8 }}
            >
              <XStack alignItems="center" gap="$3">
                <YStack
                  width={44}
                  height={44}
                  borderRadius={22}
                  backgroundColor={getAvatarColor(friend.name)}
                  justifyContent="center"
                  alignItems="center"
                >
                  <Text color="#fff" fontSize={18} fontWeight="700">
                    {getAvatarInitial(friend.name)}
                  </Text>
                </YStack>
                <YStack flex={1}>
                  <Text color="#fff" fontSize={15} fontWeight="600">
                    {friend.name}
                  </Text>
                  <Text color="#555" fontSize={13}>
                    @{friend.handle ?? 'unknown'}
                  </Text>
                </YStack>
              </XStack>
            </Button>
          ))
        ) : (
          <Text color="#888" fontSize={14} marginTop="$2">
            {friends.length === 0 ? 'フレンドがまだいません' : `「${query.trim()}」の検索結果はありません`}
          </Text>
        )}
      </YStack>
    </ScrollView>
  );
}
