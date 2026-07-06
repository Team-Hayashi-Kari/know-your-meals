import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createTamagui, TamaguiProvider } from 'tamagui';

const tamaguiConfig = createTamagui({});

export default function RootLayout() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </TamaguiProvider>
  );
}
