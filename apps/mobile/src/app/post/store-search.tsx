import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Input, Spinner, Text, XStack, YStack } from 'tamagui';
import { MiniHeader } from '../../components/post-flow/MiniHeader';
import { PhotoSlot } from '../../components/post-flow/PhotoSlot';
import { distanceInMeters, formatDistance, type PlaceResult, searchPlaces } from '../../lib/places-api';
import { getDraft, setDraftStore } from '../../lib/postDraft';

// 現在地が取得できない場合のフォールバック（渋谷駅付近、home画面と同じ値）
const FALLBACK_CENTER = { lat: 35.6595, lng: 139.7005 };

export default function StoreSearchScreen() {
  const router = useRouter();
  const draft = getDraft();

  const [center, setCenter] = useState(FALLBACK_CENTER);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/post/camera');
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setCenter({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => {
        // 権限拒否・タイムアウト等はフォールバックのまま検索を続ける
      },
    );
  }, []);

  // 検索欄への入力ごとにAPIを叩かないよう300msデバウンスする
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      searchPlaces(query, center.lat, center.lng)
        .then((places) => {
          if (!cancelled) setResults(places);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, center]);

  const handleSelect = (place: PlaceResult) => {
    setDraftStore({ placeId: place.placeId, name: place.name, address: place.address, location: place.location });
    router.push('/post/create');
  };

  return (
    <YStack flex={1} backgroundColor="#000">
      <MiniHeader title="店舗を選ぶ" onBack={handleBack} />

      <XStack paddingHorizontal="$5" paddingBottom="$4" gap="$3" alignItems="center">
        <YStack width={64} height={64}>
          <PhotoSlot uri={draft.imageUri} borderRadius={10} />
        </YStack>
        <Input
          flex={1}
          value={query}
          onChangeText={setQuery}
          placeholder="店名で検索"
          placeholderTextColor="$gray9"
          backgroundColor="#1a1a1a"
          borderWidth={0}
          color="#fff"
          height={48}
          fontSize={15}
          borderRadius="$10"
          paddingHorizontal="$4"
          autoCapitalize="none"
        />
      </XStack>

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner color="#fff" />
        </YStack>
      ) : error ? (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
          <Text color="#666" fontSize={14} textAlign="center">
            店舗検索に失敗しました。もう一度お試しください
          </Text>
        </YStack>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.placeId}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          ListEmptyComponent={
            <YStack paddingTop="$8" alignItems="center">
              <Text color="#666" fontSize={14}>
                該当する店舗が見つかりませんでした
              </Text>
            </YStack>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => handleSelect(item)} accessibilityRole="button" accessibilityLabel={item.name}>
              <YStack paddingVertical="$3" borderBottomWidth={1} borderBottomColor="#1a1a1a">
                <Text color="#fff" fontSize={16} fontWeight="700">
                  {item.name}
                </Text>
                <Text color="#888" fontSize={13} marginTop={2}>
                  {formatDistance(distanceInMeters(center, item.location))}
                </Text>
              </YStack>
            </Pressable>
          )}
        />
      )}
    </YStack>
  );
}
