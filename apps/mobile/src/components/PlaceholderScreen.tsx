import { useRouter } from 'expo-router';
import { Text, YStack } from 'tamagui';
import { MiniHeader } from './post-flow/MiniHeader';

// 本格実装前の遷移先プレースホルダー（受信/送信申請・フレンド一覧・保存した投稿・プロフィール編集）。
// クラッシュ防止のためのタイトル＋戻る導線のみ。中身は各Issueで別途実装する。
export function PlaceholderScreen({ title }: { title: string }) {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profile');
    }
  };

  return (
    <YStack flex={1} backgroundColor="#000">
      <MiniHeader title={title} onBack={goBack} />
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Text color="#555" fontSize={14}>
          準備中です
        </Text>
      </YStack>
    </YStack>
  );
}
