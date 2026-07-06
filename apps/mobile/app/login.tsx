import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { authClient } from '@/src/lib/auth-client';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        await authClient.signIn.social({
          provider: 'google',
          callbackURL: window.location.origin,
        });
        return;
      }
      // Native: open OAuth in system browser, handle deep-link callback
      const redirectUri = Linking.createURL('/');
      const { data, error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: redirectUri,
        disableRedirect: true,
      });
      if (error) throw new Error(error.message);
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'success') {
          router.replace('/(tabs)' as never);
        }
      }
    } catch (e) {
      console.error('Google sign-in failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background px-6">
      <StatusBar style="light" />

      {/* Hero */}
      <View className="flex-1 items-center justify-center gap-4">
        <Text className="text-8xl">🍚</Text>
        <Text className="text-4xl font-bold text-foreground tracking-tight text-center">Know Your{'\n'}Meals</Text>
        <Text className="text-base text-muted-foreground text-center leading-relaxed mt-1">友達と食べたお店を{'\n'}地図でシェアしよう</Text>
      </View>

      {/* Footer */}
      <View className="pb-12 gap-3">
        <Pressable onPress={handleGoogleSignIn} disabled={loading} className="bg-primary rounded-2xl py-4 items-center active:opacity-80">
          {loading ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text className="text-primary-foreground text-base font-semibold">Googleでログイン</Text>
          )}
        </Pressable>
        <Text className="text-xs text-muted-foreground text-center">ログインすることで利用規約・プライバシーポリシーに同意したものとみなします</Text>
      </View>
    </View>
  );
}
