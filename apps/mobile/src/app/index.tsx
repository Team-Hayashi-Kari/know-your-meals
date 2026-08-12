import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Button, Spinner, Text, XStack, YStack } from 'tamagui';
import { ApiError, getMe } from '../lib/api';
import { authClient } from '../lib/auth-client';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  // 既にセッションが有効なら、ログインボタンを見せずに先の画面へ即リダイレクトする
  useEffect(() => {
    getMe()
      .then((me) => {
        router.replace(me.handle ? '/home' : '/profile-setup');
      })
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) {
          console.error('[Session check error]', e);
        }
        setCheckingSession(false);
      });
  }, [router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      if (Platform.OS === 'web') {
        // Web: cross-origin fetch の state cookie はブラウザに保存されないため
        // expo-authorization-proxy 経由で first-party セットしてから Google へ
        const { data, error } = await authClient.signIn.social({
          provider: 'google',
          callbackURL: `${window.location.origin}/after-login`,
        });
        if (error) throw new Error(error.message ?? JSON.stringify(error));
        if (data?.url) {
          const params = new URLSearchParams({ authorizationURL: data.url });
          window.location.href = `${process.env.EXPO_PUBLIC_API_URL}/api/auth/expo-authorization-proxy?${params.toString()}`;
        }
      } else {
        // Native: expoClient が WebBrowser を自動で開いて OAuth を完結させる
        const { error } = await authClient.signIn.social({
          provider: 'google',
          callbackURL: '/after-login', // expoClient が Linking.createURL('/after-login') に変換
        });
        if (error) throw new Error(error.message ?? JSON.stringify(error));
        router.replace('/after-login');
      }
    } catch (e) {
      console.error('[Login error]', e);
      setError(e instanceof Error ? e.message : 'ログインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center">
        <Spinner color="#555" />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="#000" paddingHorizontal="$6" justifyContent="space-between" paddingTop="$20" paddingBottom="$12">
      {/* Branding */}
      <YStack animation="lazy" enterStyle={{ opacity: 0, y: -20 }} opacity={1} y={0}>
        <Text fontSize={48} fontWeight="900" color="#fff" letterSpacing={-2} lineHeight={52}>
          Know Your{'\n'}Meals.
        </Text>
        <Text fontSize={16} color="#555" marginTop="$4" fontWeight="500" lineHeight={24}>
          毎日の食事を、あなたのものに。
        </Text>
      </YStack>

      {/* CTA */}
      <YStack gap="$4" animation="lazy" enterStyle={{ opacity: 0, y: 30 }} opacity={1} y={0}>
        {error ? (
          <Text color="#ff4444" fontSize={14} textAlign="center">
            {error}
          </Text>
        ) : null}

        <Button
          onPress={handleGoogleLogin}
          disabled={loading}
          backgroundColor="#fff"
          pressStyle={{ backgroundColor: '#e8e8e8', scale: 0.97 }}
          animation="fast"
          borderRadius="$5"
          height={60}
          disabledStyle={{ opacity: 0.5 }}
        >
          {loading ? (
            <Spinner color="#000" />
          ) : (
            <XStack alignItems="center" gap="$3">
              {/* Google G mark */}
              <Text fontSize={20} lineHeight={20}>
                G
              </Text>
              <Text color="#000" fontWeight="700" fontSize={16} letterSpacing={0.2}>
                Googleでログイン
              </Text>
            </XStack>
          )}
        </Button>

        <Text color="#333" fontSize={12} textAlign="center" lineHeight={18}>
          続行することで利用規約およびプライバシーポリシーに同意したものとみなされます。
        </Text>
      </YStack>
    </YStack>
  );
}
