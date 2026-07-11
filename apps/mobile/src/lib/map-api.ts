// apps/mobile/src/lib/map-api.ts
//
// マップ画面（Task1/FE-8）用の実APIクライアント。GET /api/map/posts?bbox= を叩く。
import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { apiFetch, buildApiUrl } from './api-client';
import type { NearbyPost, PinEmoji } from './mock-api';

type MapPin = {
  postId: number;
  pin: PinEmoji;
  comment: string | null;
  createdAt: string;
  lat: number;
  lng: number;
  shopName: string;
  imageUrl: string | null;
  author: { id: string; handle: string | null; name: string; image: string | null };
};

// 地図の実表示範囲(zoom/bounds)は追わず、現在地から固定半径のbboxで近似する
const SEARCH_RADIUS_METERS = 3000;
const EARTH_RADIUS_METERS = 6_371_000;

function buildBbox(center: { lat: number; lng: number }, radiusMeters: number): string {
  const latDelta = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lngDelta = latDelta / Math.cos((center.lat * Math.PI) / 180);
  const swLat = center.lat - latDelta;
  const swLng = center.lng - lngDelta;
  const neLat = center.lat + latDelta;
  const neLng = center.lng + lngDelta;
  return `${swLat},${swLng},${neLat},${neLng}`;
}

// ハーサイン公式で現在地から店舗までの距離(m)を算出
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h)));
}

// GET /api/map/posts?bbox= 相当
export async function getNearbyPosts(center: { lat: number; lng: number }): Promise<NearbyPost[]> {
  const bbox = buildBbox(center, SEARCH_RADIUS_METERS);
  const data = await apiFetch<{ pins: MapPin[] }>(`/api/map/posts?bbox=${encodeURIComponent(bbox)}`);

  return data.pins.map((pin) => ({
    id: String(pin.postId),
    userName: pin.author.name,
    userInitial: getAvatarInitial(pin.author.name),
    userColor: getAvatarColor(pin.author.name),
    storeName: pin.shopName,
    genreEmoji: pin.pin,
    comment: pin.comment ?? '',
    imageUri: pin.imageUrl ? buildApiUrl(pin.imageUrl) : null,
    isFriendPost: false, // 表示範囲は既にサーバー側(自分/フレンド)で絞り込み済みのため未使用
    postedAt: pin.createdAt,
    distanceMeters: haversineMeters(center, { lat: pin.lat, lng: pin.lng }),
    isBookmarked: false, // 地図一覧では未使用（保存状態は投稿詳細/保存済み一覧で管理）
    isMine: false, // 地図一覧では未使用
    lat: pin.lat,
    lng: pin.lng,
  }));
}
