import { useRouter } from 'expo-router';
import { Spinner, Text, YStack } from 'tamagui';
import { authClient } from '../../src/lib/auth-client';

export default function HomeScreen() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

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
      <Text color="#444" fontSize={13} fontWeight="600" onPress={handleLogout} marginTop="$4">
        ログアウト
      </Text>
    </YStack>
  );
}
