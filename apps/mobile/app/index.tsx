import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { authClient } from '@/src/lib/auth-client';

export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      await new Promise((r) => setTimeout(r, 800));
      try {
        const session = await authClient.getSession();
        if (session.data?.session) {
          router.replace('/(tabs)' as never);
        } else {
          router.replace('/login');
        }
      } catch {
        router.replace('/login');
      }
    });
  }, [opacity, scale, taglineOpacity]);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Animated.View style={{ opacity, transform: [{ scale }] }} className="items-center">
        <Text className="text-7xl mb-5">🍚</Text>
        <Text className="text-3xl font-bold text-foreground tracking-tight">Know Your Meals</Text>
      </Animated.View>
      <Animated.View style={{ opacity: taglineOpacity }} className="mt-3">
        <Text className="text-base text-muted-foreground">あの店、美味しかったな</Text>
      </Animated.View>
    </View>
  );
}
