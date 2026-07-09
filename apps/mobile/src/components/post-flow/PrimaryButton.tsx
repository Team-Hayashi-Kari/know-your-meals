import { Button, Spinner, Text } from 'tamagui';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function PrimaryButton({ label, onPress, disabled, loading }: PrimaryButtonProps) {
  return (
    <Button
      onPress={onPress}
      disabled={disabled || loading}
      backgroundColor="#fff"
      pressStyle={{ backgroundColor: '#e8e8e8', scale: 0.97 }}
      borderRadius="$5"
      height={60}
      disabledStyle={{ opacity: 0.5 }}
    >
      {loading ? (
        <Spinner color="#000" />
      ) : (
        <Text color="#000" fontWeight="700" fontSize={16}>
          {label}
        </Text>
      )}
    </Button>
  );
}
