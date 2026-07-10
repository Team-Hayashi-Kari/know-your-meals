import { Pressable } from 'react-native';
import { Input, XStack } from 'tamagui';
import { Avatar } from '../post-flow/Avatar';

type MapSearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  userInitial: string;
};

// アバターのタップ先（プロフィール画面）はまだこのリポジトリに存在しないため未接続。
// 該当ルートができ次第、Pressable の onPress でそこへ遷移させる。
export function MapSearchBar({ value, onChangeText, userInitial }: MapSearchBarProps) {
  return (
    <XStack alignItems="center" gap="$3" paddingHorizontal="$5" paddingTop="$4" paddingBottom="$3">
      <Input
        flex={1}
        value={value}
        onChangeText={onChangeText}
        placeholder="店・エリアで検索"
        placeholderTextColor="$gray9"
        backgroundColor="#1a1a1a"
        borderWidth={0}
        color="#fff"
        height={48}
        fontSize={15}
        borderRadius="$10"
        paddingHorizontal="$4"
        autoCapitalize="none"
      />
      <Pressable accessibilityRole="button" accessibilityLabel="プロフィール">
        <Avatar initial={userInitial} size={40} />
      </Pressable>
    </XStack>
  );
}
