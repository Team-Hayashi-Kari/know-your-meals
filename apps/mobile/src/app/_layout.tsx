import { config } from '@tamagui/config';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createTamagui, TamaguiProvider } from 'tamagui';

const tamaguiConfig = createTamagui(config);

export default function RootLayout() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </TamaguiProvider>
  );
}
