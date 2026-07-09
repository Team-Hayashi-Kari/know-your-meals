import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Spinner, YStack } from 'tamagui';
import { getMe } from '../lib/mock-api';

export default function AfterLoginScreen() {
  const router = useRouter();

  useEffect(() => {
    // ログイン直後に自分の情報を取得して、行き先を振り分ける
    getMe().then((me) => {
      if (!me.handle) {
        // handle が未設定 → 初回なのでプロフィール作成へ
        router.replace('/profile-setup');
      } else {
        // handle が設定済み → 2回目以降なのでホームへ
        router.replace('/home');
      }
    });
  }, []);

  // 判定が終わるまでの間、ぐるぐる（ローディング）を表示
  return (
    <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center">
      <Spinner color="#fff" size="large" />
    </YStack>
  );
}
