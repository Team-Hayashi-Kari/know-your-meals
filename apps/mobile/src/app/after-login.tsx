import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Spinner, Text, YStack } from 'tamagui';
import { ApiError, getMe } from '../lib/api';

export default function AfterLoginScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((me) => {
        if (!me.handle) {
          router.replace('/profile-setup');
        } else {
          router.replace('/home');
        }
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          router.replace('/');
          return;
        }
        console.error('[プロフィール取得エラー]', e);
        const message = e instanceof Error ? e.message : 'Unknown error';
        setError(`プロフィールの取得に失敗しました: ${message}`);
      });
  }, [router]);

  // 判定が終わるまでの間、ぐるぐる（ローディング）を表示
  return (
    <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center" gap="$3">
      {error ? <Text color="#fff">{error}</Text> : <Spinner color="#fff" size="large" />}
    </YStack>
  );
}
