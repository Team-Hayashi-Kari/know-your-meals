import { AdvancedMarker, APIProvider, Map, useApiIsLoaded, useApiLoadingStatus } from '@vis.gl/react-google-maps';
import { Text, YStack } from 'tamagui';
import type { NearbyPost } from '../../lib/mock-api';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Google Cloud Console側で発行するMap ID。AdvancedMarker（カスタムピン表示）に必要。
// 未発行の間は、Google公式が検証用に提供している 'DEMO_MAP_ID' にフォールバックする。
// 参照: https://developers.google.com/maps/documentation/javascript/advanced-markers/migration
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

type GoogleMapViewProps = {
  center: { lat: number; lng: number };
  posts: NearbyPost[];
  onPressPost: (postId: string) => void;
};

export function GoogleMapView({ center, posts, onPressPost }: GoogleMapViewProps) {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <YStack flex={1} backgroundColor="#0f0f10" justifyContent="center" alignItems="center" padding="$5" gap="$2">
        <Text color="#ddd" fontSize={15} fontWeight="700" textAlign="center">
          地図を表示できません
        </Text>
        <Text color="#666" fontSize={13} textAlign="center" lineHeight={20}>
          apps/mobile/.env に EXPO_PUBLIC_GOOGLE_MAPS_API_KEY が設定されていません
        </Text>
      </YStack>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <MapInner center={center} posts={posts} onPressPost={onPressPost} />
    </APIProvider>
  );
}

function MapInner({ center, posts, onPressPost }: GoogleMapViewProps) {
  const isLoaded = useApiIsLoaded();
  const loadingStatus = useApiLoadingStatus();

  if (loadingStatus === 'FAILED' || loadingStatus === 'AUTH_FAILURE') {
    return (
      <YStack flex={1} backgroundColor="#0f0f10" justifyContent="center" alignItems="center" padding="$5" gap="$2">
        <Text color="#ddd" fontSize={15} fontWeight="700" textAlign="center">
          地図を読み込めませんでした
        </Text>
        <Text color="#666" fontSize={13} textAlign="center" lineHeight={20}>
          Google Maps APIキーが無効か、Maps JavaScript APIが有効化されていない可能性があります
        </Text>
      </YStack>
    );
  }

  if (!isLoaded) {
    return (
      <YStack flex={1} backgroundColor="#0f0f10" justifyContent="center" alignItems="center">
        <Text color="#555" fontSize={13}>
          地図を読み込み中…
        </Text>
      </YStack>
    );
  }

  return (
    <Map
      mapId={MAP_ID}
      defaultCenter={center}
      defaultZoom={15}
      disableDefaultUI
      gestureHandling="greedy"
      style={{ width: '100%', height: '100%' }}
      colorScheme="DARK"
    >
      {/* 現在地マーカー */}
      <AdvancedMarker position={center}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#4a9eff',
            border: '3px solid #fff',
            boxShadow: '0 0 0 3px rgba(74,158,255,0.3)',
          }}
        />
      </AdvancedMarker>

      {/* 投稿ピン */}
      {posts.map((post) => (
        <AdvancedMarker key={post.id} position={{ lat: post.lat, lng: post.lng }} onClick={() => onPressPost(post.id)}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              cursor: 'pointer',
            }}
          >
            {post.genreEmoji}
          </div>
        </AdvancedMarker>
      ))}
    </Map>
  );
}
