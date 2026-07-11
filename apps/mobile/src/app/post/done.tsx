import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, YStack } from 'tamagui';
import { PinBadge } from '../../components/post-flow/PinBadge';
import { PrimaryButton } from '../../components/post-flow/PrimaryButton';
import { SecondaryButton } from '../../components/post-flow/SecondaryButton';

export default function PostDoneScreen() {
  const router = useRouter();
  const { storeName, pin, comment } = useLocalSearchParams<{ storeName?: string; pin?: string; comment?: string }>();

  const handleViewMap = () => {
    router.replace('/home');
  };

  const handlePostAgain = () => {
    router.replace('/post/camera');
  };

  return (
    <YStack flex={1} backgroundColor="#000" justifyContent="space-between" paddingHorizontal="$5" paddingVertical="$6">
      <YStack flex={1} justifyContent="center" alignItems="center" gap="$4">
        <YStack width={72} height={72} borderRadius={36} backgroundColor="#e8b04b" justifyContent="center" alignItems="center">
          <Text fontSize={36} color="#000" fontWeight="800">
            ✓
          </Text>
        </YStack>

        <Text color="#fff" fontSize={22} fontWeight="800">
          投稿しました
        </Text>
        <Text color="#888" fontSize={14}>
          マップに投稿が反映されました
        </Text>

        {storeName ? (
          <YStack width="100%" marginTop="$5" padding="$4" borderRadius="$5" backgroundColor="#151517" gap="$3" alignItems="center">
            {pin ? <PinBadge emoji={pin} /> : null}
            <Text color="#fff" fontSize={17} fontWeight="700" textAlign="center">
              {storeName}
            </Text>
            {comment ? (
              <Text color="#aaa" fontSize={14} textAlign="center">
                {comment}
              </Text>
            ) : null}
          </YStack>
        ) : null}
      </YStack>

      <YStack gap="$3">
        <PrimaryButton label="地図で見る" onPress={handleViewMap} />
        <SecondaryButton label="続けて投稿" onPress={handlePostAgain} />
      </YStack>
    </YStack>
  );
}
