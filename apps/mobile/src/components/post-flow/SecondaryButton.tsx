import type { ReactNode } from 'react';
import { Button, Text, XStack } from 'tamagui';

type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
};

export function SecondaryButton({ label, onPress, disabled, icon }: SecondaryButtonProps) {
  return (
    <Button
      onPress={onPress}
      disabled={disabled}
      backgroundColor="transparent"
      borderWidth={1}
      borderColor="#2a2a2a"
      pressStyle={{ backgroundColor: '#151517', scale: 0.97 }}
      borderRadius="$5"
      height={56}
      disabledStyle={{ opacity: 0.5 }}
    >
      <XStack alignItems="center" gap="$2">
        {icon}
        <Text color="#ddd" fontWeight="700" fontSize={15}>
          {label}
        </Text>
      </XStack>
    </Button>
  );
}
