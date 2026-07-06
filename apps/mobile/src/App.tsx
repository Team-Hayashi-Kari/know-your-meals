import tamaguiConfig from '@tamagui/config';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider, Text, YStack } from 'tamagui';

export default function App() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <Text>Open up App.tsx to start working on your app!</Text>
        <StatusBar style="auto" />
      </YStack>
    </TamaguiProvider>
  );
}
