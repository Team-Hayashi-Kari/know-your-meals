import { Text, YStack } from 'tamagui';

type PinBadgeProps = {
  emoji: string;
  size?: number;
  // undefined: 表示用の白丸バッジ（マップピン/投稿完了サマリ/投稿詳細バッジ）
  // true/false: 投稿作成画面のピン選択スワッチ（選択中はゴールド枠、未選択はダーク背景）
  selected?: boolean;
};

export function PinBadge({ emoji, size = 44, selected }: PinBadgeProps) {
  const isSelectable = selected !== undefined;

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={size / 2}
      backgroundColor={isSelectable ? (selected ? '#fff' : '#151517') : '#fff'}
      borderWidth={isSelectable ? (selected ? 2 : 1) : 0}
      borderColor={isSelectable ? (selected ? '#e8b04b' : '#2a2a2a') : undefined}
      justifyContent="center"
      alignItems="center"
      shadowColor="#000"
      shadowOpacity={isSelectable ? 0 : 0.5}
      shadowRadius={8}
      shadowOffset={{ width: 0, height: 6 }}
      elevation={isSelectable ? 0 : 6}
    >
      <Text fontSize={size * 0.45}>{emoji}</Text>
    </YStack>
  );
}
