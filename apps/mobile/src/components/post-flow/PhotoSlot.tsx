import { Image } from 'react-native';
import { Text, YStack } from 'tamagui';

type PhotoSlotProps = {
  uri?: string | null;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  label?: string;
};

export function PhotoSlot({ uri, width = '100%', height = '100%', borderRadius = 12, label }: PhotoSlotProps) {
  return (
    <YStack
      width={width}
      height={height}
      borderRadius={borderRadius}
      overflow="hidden"
      backgroundColor="#0f0f10"
      justifyContent="center"
      alignItems="center"
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : label ? (
        <Text color="#666" fontSize={13} textAlign="center" paddingHorizontal="$2">
          {label}
        </Text>
      ) : null}
    </YStack>
  );
}
