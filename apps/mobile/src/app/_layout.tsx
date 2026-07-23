import config from '@tamagui-config';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { initAuthStorage } from '../lib/auth-storage';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initAuthStorage().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </TamaguiProvider>
  );
}
