import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Spinner, Text, YStack } from 'tamagui';
import { authClient } from '../../lib/auth-client';
import { getReceivedFriendRequests } from '../../lib/mock-api';

export default function HomeScreen() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [receivedCount, setReceivedCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getReceivedFriendRequests()
        .then((requests) => setReceivedCount(requests.length))
        .catch(() => setReceivedCount(0));
    }, []),
  );

  const handleLogout = async () => {
    await authClient.signOut();
    router.replace('/');
  };

  if (isPending) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center">
        <Spinner color="#fff" size="large" />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center" gap="$4">
      <Text color="#fff" fontSize={24} fontWeight="700">
        ホーム
      </Text>
      <Text color="#555" fontSize={14}>
        {session?.user?.email ?? ''}
      </Text>
      <Text color="#fff" fontSize={14} fontWeight="600" onPress={() => router.push('/home/friends')}>
        受信した申請{receivedCount > 0 ? ` ${receivedCount}` : ''}
      </Text>
      <Text color="#444" fontSize={13} fontWeight="600" onPress={handleLogout} marginTop="$4">
        ログアウト
      </Text>
    </YStack>
  );
}
