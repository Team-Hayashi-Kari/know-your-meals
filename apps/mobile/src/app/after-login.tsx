import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Spinner, YStack } from 'tamagui';
import { getMe } from '../lib/mock-api';

export default function AfterLoginScreen() {
  const router = useRouter();

  useEffect(() => {
    getMe().then((me) => {
      if (!me.handle) {
        router.replace('/profile-setup');
      } else {
        router.replace('/home');
      }
    });
  }, [router]);

  // 判定が終わるまでの間、ぐるぐる（ローディング）を表示
  return (
    <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center">
      <Spinner color="#fff" size="large" />
    </YStack>
  );
}
