import { Text, YStack } from 'tamagui';

type AvatarProps = {
  initial: string;
  color?: string;
  size?: number;
};

// 自分のアバター（検索バー・プロフィール）はゴールドで統一。他ユーザーは呼び出し側から色を渡す。
export function Avatar({ initial, color = '#e8b04b', size = 40 }: AvatarProps) {
  return (
    <YStack width={size} height={size} borderRadius={size / 2} backgroundColor={color} justifyContent="center" alignItems="center">
      <Text color="#000" fontWeight="800" fontSize={size * 0.4}>
        {initial}
      </Text>
    </YStack>
  );
}
