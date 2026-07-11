import { useLocalSearchParams } from 'expo-router';
import { Text, YStack } from 'tamagui';

export default function UserProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();

  return (
    <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center" paddingHorizontal="$6">
      <Text color="#fff" fontSize={28} fontWeight="800" textAlign="center">
        @{handle}
      </Text>
      <Text color="#555" marginTop="$3" textAlign="center">
        他人のプロフィール（FE-16）
      </Text>
    </YStack>
  );
}
