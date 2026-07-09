import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Text, XStack } from 'tamagui';

type MiniHeaderProps = {
  title?: string;
  onBack: () => void;
  rightAction?: ReactNode;
};

// 戻る矢印＋タイトル（店舗選択・投稿作成）／戻る矢印＋右アクションのみ（投稿詳細）の両方に対応
export function MiniHeader({ title, onBack, rightAction }: MiniHeaderProps) {
  return (
    <XStack alignItems="center" justifyContent="space-between" paddingHorizontal="$5" paddingVertical="$3">
      <XStack alignItems="center" gap="$3">
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="戻る">
          <Text fontSize={22} color="#fff">
            ←
          </Text>
        </Pressable>
        {title ? (
          <Text fontSize={19} fontWeight="800" color="#fff" letterSpacing={-0.5}>
            {title}
          </Text>
        ) : null}
      </XStack>
      {rightAction}
    </XStack>
  );
}
