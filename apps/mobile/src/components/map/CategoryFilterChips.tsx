import { Pressable } from 'react-native';
import { ScrollView, Text, XStack } from 'tamagui';
import type { PinEmoji } from '../../lib/mock-api';

const CATEGORIES: PinEmoji[] = ['🍜', '🍣', '🍛', '🍙', '🍔', '🍕', '🥩', '🍰', '🍺', '🥟'];

type CategoryFilterChipsProps = {
  selected: PinEmoji | null;
  onChange: (value: PinEmoji | null) => void;
};

export function CategoryFilterChips({ selected, onChange }: CategoryFilterChipsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
      <Chip label="すべて" active={selected === null} onPress={() => onChange(null)} />
      {CATEGORIES.map((emoji) => (
        <Chip key={emoji} label={emoji} active={selected === emoji} onPress={() => onChange(emoji)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <XStack
        backgroundColor={active ? '#fff' : '#151517'}
        borderWidth={1}
        borderColor={active ? '#fff' : '#2a2a2a'}
        borderRadius="$10"
        paddingHorizontal="$3"
        paddingVertical="$2"
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize={15} color={active ? '#000' : '#ddd'} fontWeight={active ? '700' : '500'}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}
