import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Input, Spinner, Text, XStack, YStack } from 'tamagui';
import { searchUsers, sendFriendRequest, type UserSearchResult } from '../lib/mock-api';

export default function FindFriendsScreen() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // 検索欄に文字が入るたびに、モックAPIで検索する
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
    <YStack
      flex={1}
      backgroundColor="#000"
      paddingHorizontal="$6"
      paddingTop="$16"
      paddingBottom="$8"
    >
      {/* 上部：ステップ表示 と スキップ */}
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <Text color="#555" fontSize={13} fontWeight="600">
          ステップ 2 / 2
        </Text>
        <Text
          color="#555"
          fontSize={13}
          fontWeight="600"
          onPress={() => router.replace('/home')}
        >
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
      <YStack flex={1} gap="$3">
        {loading ? (
          <Spinner color="#555" marginTop="$4" />
        ) : (
          results.map((user) => (
            <UserRow key={user.id} user={user} />
          ))
        )}
      </YStack>

      {/* 下部：はじめるボタン */}
      <Button
        onPress={() => router.replace('/home')}
        backgroundColor="#fff"
        pressStyle={{ backgroundColor: '#e8e8e8', scale: 0.97 }}
        borderRadius="$5"
        height={60}
        marginTop="$4"
      >
        <Text color="#000" fontWeight="700" fontSize={16}>
          はじめる
        </Text>
      </Button>
    </YStack>
  );
}

// ===== ユーザー1人分の行 =====
function UserRow({ user }: { user: UserSearchResult }) {
  // この人への申請状態を覚えておく（申請したらボタンの表示を変えるため）
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
      {/* アイコン（頭文字＋色） */}
      <YStack
        width={44}
        height={44}
        borderRadius={22}
        backgroundColor={getColorFromName(user.name)}
        justifyContent="center"
        alignItems="center"
      >
        <Text color="#fff" fontSize={18} fontWeight="700">
          {getInitial(user.name)}
        </Text>
      </YStack>

      {/* 名前とID */}
      <YStack flex={1}>
        <Text color="#fff" fontSize={15} fontWeight="600">
          {user.name}
        </Text>
        <Text color="#555" fontSize={13}>
          @{user.handle}
        </Text>
      </YStack>

      {/* 申請ボタン（状態で表示が変わる） */}
      {status === 'pending_sent' ? (
        <Text color="#555" fontSize={13} fontWeight="600">
          申請中
        </Text>
      ) : (
        <Button
          onPress={handleSend}
          disabled={sending}
          backgroundColor="#1a1a1a"
          borderRadius="$4"
          height={36}
          paddingHorizontal="$4"
        >
          <Text color="#ffd400" fontSize={13} fontWeight="700">
            申請する
          </Text>
        </Button>
      )}
    </XStack>
  );
}

// ===== アイコン用の道具（プロフィール画面と同じもの） =====
function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393'];
  if (!name.trim()) return '#333';
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}
