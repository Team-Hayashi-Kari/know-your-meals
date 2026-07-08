import { useRouter } from 'expo-router';
import { Button, Text, YStack } from 'tamagui';

export default function ProfileSetupScreen() {
  const router = useRouter();

  return (
    <YStack
      flex={1}
      backgroundColor="#000"
      justifyContent="center"
      alignItems="center"
      gap="$4"
    >
      <Text color="#fff" fontSize={24} fontWeight="700">
        プロフィール作成（仮）
      </Text>

      <Button
        onPress={() => router.replace('/home')}
        backgroundColor="#fff"
        borderRadius="$5"
        height={50}
        paddingHorizontal="$6"
      >
        <Text color="#000" fontWeight="700">
          とりあえずホームへ
        </Text>
      </Button>
    </YStack>
  );
}
