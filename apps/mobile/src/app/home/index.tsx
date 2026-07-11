import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { YStack } from 'tamagui';
import { CategoryFilterChips } from '../../components/map/CategoryFilterChips';
import { GoogleMapView } from '../../components/map/GoogleMapView';
import { MapSearchBar } from '../../components/map/MapSearchBar';
import { NearbyPostsSheet } from '../../components/map/NearbyPostsSheet';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { ProfileMenu } from '../../components/navigation/ProfileMenu';
import { getMe, getNearbyPosts, getReceivedFriendRequests, type NearbyPost, type PinEmoji } from '../../lib/mock-api';

// 現在地が取得できない場合のフォールバック（渋谷駅付近）
const FALLBACK_CENTER = { lat: 35.6595, lng: 139.7005 };

export default function HomeScreen() {
  const router = useRouter();

  const [center, setCenter] = useState(FALLBACK_CENTER);
  const [posts, setPosts] = useState<NearbyPost[]>([]);
  const [userName, setUserName] = useState('');
  const [userHandle, setUserHandle] = useState<string | null>(null);
  const [userInitial, setUserInitial] = useState('?');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PinEmoji | null>(null);
  const [receivedCount, setReceivedCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getReceivedFriendRequests()
        .then((requests) => setReceivedCount(requests.length))
        .catch(() => setReceivedCount(0));
    }, []),
  );

  // 現在地を取得（拒否/未対応の場合はフォールバックのまま）
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        // 権限拒否・タイムアウト等はフォールバックのまま表示を続ける
      },
    );
  }, []);

  useEffect(() => {
    getNearbyPosts(center.lat, center.lng).then(setPosts);
  }, [center]);

  useEffect(() => {
    getMe().then((me) => {
      const name = me.name.trim();
      setUserName(name);
      setUserHandle(me.handle);
      setUserInitial(name ? name.charAt(0).toUpperCase() : '?');
    });
  }, []);

  const visiblePosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return posts
      .filter((post) => (selectedCategory ? post.genreEmoji === selectedCategory : true))
      .filter((post) => (query ? post.storeName.toLowerCase().includes(query) : true))
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  }, [posts, searchQuery, selectedCategory]);

  const goToPostDetail = (postId: string) => {
    router.push(`/posts/${postId}`);
  };

  return (
    <YStack flex={1} backgroundColor="#000">
      <MapSearchBar value={searchQuery} onChangeText={setSearchQuery} userInitial={userInitial} onPressProfile={() => setMenuOpen(true)} />

      <YStack paddingBottom="$3">
        <CategoryFilterChips selected={selectedCategory} onChange={setSelectedCategory} />
      </YStack>

      <YStack flex={1} position="relative">
        <GoogleMapView center={center} posts={visiblePosts} onPressPost={goToPostDetail} />
        <NearbyPostsSheet posts={visiblePosts} onPressPost={goToPostDetail} />
      </YStack>

      <BottomTabBar />

      <ProfileMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        userInitial={userInitial}
        name={userName}
        handle={userHandle}
        receivedRequestCount={receivedCount}
      />
    </YStack>
  );
}
