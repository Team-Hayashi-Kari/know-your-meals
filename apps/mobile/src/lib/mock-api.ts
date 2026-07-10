// apps/mobile/src/lib/mock-api.ts
//
// 🔧 これはモック（仮の）APIです。
// バックエンドが完成したら、この中の実装だけを本物の fetch() 呼び出しに差し替えます。
// 関数名・引数・戻り値の型は API設計書（GET/PATCH /api/me など）に合わせてあります。

import { Platform } from 'react-native';
import { authClient } from './auth-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (Platform.OS !== 'web') {
    headers.Cookie = authClient.getCookie();
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: Platform.OS === 'web' ? 'include' : undefined,
    headers,
  });
}

export type MeProfile = {
  id: string;
  name: string;
  handle: string | null; // null なら「初回プロフィール未設定」
  bio: string | null;
  image: string | null;
};

export type UserSearchResult = {
  id: string;
  name: string;
  handle: string;
  image: string | null;
  relationshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends';
};

// ---- 仮データ（本物のDBの代わり） ----
let mockMe: MeProfile = {
  id: 'mock-user-1',
  name: '',
  handle: null,
  bio: null,
  image: null,
};

const mockUsers: UserSearchResult[] = [
  { id: 'u1', name: 'Yuki Tanaka', handle: 'yuki_eats', image: null, relationshipStatus: 'pending_sent' },
  { id: 'u2', name: 'Ryo Sato', handle: 'ryo.food', image: null, relationshipStatus: 'none' },
  { id: 'u3', name: 'Aoi', handle: 'aoi_gohan', image: null, relationshipStatus: 'none' },
  { id: 'u4', name: 'Takumi', handle: 'tkm.eats', image: null, relationshipStatus: 'none' },
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GET /api/me 相当
export async function getMe(): Promise<MeProfile> {
  await delay(200);
  return mockMe;
}

// PATCH /api/me 相当
export async function updateMe(data: Partial<Pick<MeProfile, 'name' | 'handle' | 'bio' | 'image'>>): Promise<MeProfile> {
  await delay(300);
  // 本物のAPIでは、ここで handle の重複チェック(409)が入る
  mockMe = { ...mockMe, ...data };
  return mockMe;
}

// GET /api/users/search?q= 相当
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  await delay(300);
  if (!query) return [];
  const q = query.toLowerCase().replace('@', '');
  return mockUsers.filter((u) => u.handle.includes(q) || u.name.toLowerCase().includes(q));
}

// GET /api/users/suggestions 相当（おすすめフレンド）
export async function getSuggestedUsers(): Promise<UserSearchResult[]> {
  await delay(300);
  // まだフレンドでない人をおすすめとして返す
  return mockUsers.filter((u) => u.relationshipStatus === 'none');
}

// GET /api/users/check-handle?handle= 相当
// そのIDが使えるか（他の人に使われていないか）を返す
export async function checkHandleAvailable(handle: string): Promise<boolean> {
  await delay(300);
  const h = handle.toLowerCase().replace('@', '');
  // 既存ユーザーの handle と一致したら「使われている（false）」
  const taken = mockUsers.some((u) => u.handle.toLowerCase() === h);
  return !taken;
}

// POST /api/friendships 相当
export async function sendFriendRequest(userId: string): Promise<void> {
  await delay(300);
  const target = mockUsers.find((u) => u.id === userId);
  if (target) target.relationshipStatus = 'pending_sent';
}

// GET /api/me/friend-requests?direction=received
export type ReceivedFriendRequest = {
  friendshipId: number;
  id: string;
  handle: string | null;
  name: string;
  image: string | null;
  bio: string | null;
  mutualFriendCount: number;
};

export async function getReceivedFriendRequests(): Promise<ReceivedFriendRequest[]> {
  const res = await apiFetch('/api/me/friend-requests?direction=received');
  if (!res.ok) throw new Error(`failed to fetch friend requests: ${res.status}`);
  return res.json();
}

// PATCH /api/friendships/:id
export async function updateFriendshipRequest(friendshipId: number, data: { status: 'accepted' | 'denied' }): Promise<void> {
  const res = await apiFetch(`/api/friendships/${friendshipId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`failed to update friendship request: ${res.status}`);
}

// pinEmojiEnum (packages/db/src/schema/content.ts) と揃える
export type PinEmoji = '🍜' | '🍣' | '🍛' | '🍙' | '🍔' | '🍕' | '🥩' | '🍰' | '🍺' | '🥟';

export type NearbyPost = {
  id: string;
  userName: string;
  userInitial: string;
  userColor: string;
  storeName: string;
  genreEmoji: PinEmoji;
  comment: string;
  imageUri: string | null;
  isFriendPost: boolean;
  postedAt: string; // ISO8601。本物のAPI（GET /api/posts/:id）では posts.createdAt 相当
  distanceMeters: number; // 現在地からの距離。本物は現在地×店舗座標から算出するためプレースホルダー（[[post-detail-distance-needs-task1-coordination]]参照）
  isBookmarked: boolean; // 本物のAPI（GET /api/posts/:id、PR #111）では bookmarks への LEFT JOIN で判定
  isMine: boolean; // 自分の投稿かどうか。本物は posts.userId === 自分のuserId で判定
  lat: number; // 店舗の緯度。マップ画面(FE-8)のピン表示に使用
  lng: number; // 店舗の経度。マップ画面(FE-8)のピン表示に使用
};

const mockNearbyPosts: NearbyPost[] = [
  {
    id: 'p1',
    userName: 'Yuki Tanaka',
    userInitial: 'Y',
    userColor: '#F4A259',
    storeName: '麺屋 一心',
    genreEmoji: '🍜',
    comment: '味噌ラーメンが最高でした',
    imageUri: null,
    isFriendPost: true,
    postedAt: '2026-07-09T22:20:00+09:00',
    distanceMeters: 320,
    isBookmarked: false,
    isMine: false,
    lat: 35.662,
    lng: 139.7038,
  },
  {
    id: 'p2',
    userName: 'Ryo Sato',
    userInitial: 'R',
    userColor: '#5B8C5A',
    storeName: '鮨処 なかむら',
    genreEmoji: '🍣',
    comment: '大将のおまかせが絶品',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-09T19:05:00+09:00',
    distanceMeters: 540,
    isBookmarked: false,
    isMine: false,
    lat: 35.657,
    lng: 139.698,
  },
  {
    id: 'p3',
    userName: 'Aoi',
    userInitial: 'A',
    userColor: '#4A7A96',
    storeName: '中華飯店 龍',
    genreEmoji: '🍛',
    comment: '麻婆豆腐が辛旨い',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-09T21:40:00+09:00',
    distanceMeters: 810,
    isBookmarked: false,
    isMine: false,
    lat: 35.664,
    lng: 139.705,
  },
  {
    id: 'p4',
    userName: 'Takumi',
    userInitial: 'T',
    userColor: '#B85C5C',
    storeName: 'おにぎり結び',
    genreEmoji: '🍙',
    comment: '塩むすびが染みる',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-09T18:15:00+09:00',
    distanceMeters: 150,
    isBookmarked: false,
    isMine: true,
    lat: 35.66,
    lng: 139.699,
  },
  {
    id: 'p5',
    userName: 'Yuki Tanaka',
    userInitial: 'Y',
    userColor: '#F4A259',
    storeName: 'バーガーテラス',
    genreEmoji: '🍔',
    comment: 'パティが分厚い！',
    imageUri: null,
    isFriendPost: true,
    postedAt: '2026-07-09T12:30:00+09:00',
    distanceMeters: 970,
    isBookmarked: false,
    isMine: false,
    lat: 35.656,
    lng: 139.704,
  },
  {
    id: 'p6',
    userName: 'Mika',
    userInitial: 'M',
    userColor: '#8C6FA9',
    storeName: 'ピッツェリア ソーレ',
    genreEmoji: '🍕',
    comment: 'マルゲリータが本格的',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-08T19:50:00+09:00',
    distanceMeters: 1200,
    isBookmarked: false,
    isMine: false,
    lat: 35.666,
    lng: 139.696,
  },
  {
    id: 'p7',
    userName: 'Kenji',
    userInitial: 'K',
    userColor: '#3D8C7D',
    storeName: '焼肉 炎',
    genreEmoji: '🥩',
    comment: '特上カルビ食べ放題',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-08T20:10:00+09:00',
    distanceMeters: 430,
    isBookmarked: false,
    isMine: false,
    lat: 35.658,
    lng: 139.707,
  },
  {
    id: 'p8',
    userName: 'Ryo Sato',
    userInitial: 'R',
    userColor: '#5B8C5A',
    storeName: 'パティスリー花',
    genreEmoji: '🍰',
    comment: 'モンブランが季節限定',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-07T15:00:00+09:00',
    distanceMeters: 260,
    isBookmarked: false,
    isMine: false,
    lat: 35.661,
    lng: 139.695,
  },
  {
    id: 'p9',
    userName: 'Aoi',
    userInitial: 'A',
    userColor: '#4A7A96',
    storeName: '角打ち酒場 星',
    genreEmoji: '🍺',
    comment: 'ハイボールと餃子が最強',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-06T22:30:00+09:00',
    distanceMeters: 690,
    isBookmarked: false,
    isMine: false,
    lat: 35.655,
    lng: 139.701,
  },
  {
    id: 'p10',
    userName: 'Takumi',
    userInitial: 'T',
    userColor: '#B85C5C',
    storeName: '点心楼',
    genreEmoji: '🥟',
    comment: '小籠包の肉汁がやばい',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-06T13:45:00+09:00',
    distanceMeters: 1050,
    isBookmarked: false,
    isMine: false,
    lat: 35.665,
    lng: 139.7,
  },
];

// GET /api/map/posts?bbox= 相当
export async function getNearbyPosts(lat: number, lng: number): Promise<NearbyPost[]> {
  await delay(300);
  // 本物のAPIでは lat/lng から算出した bbox で範囲検索する
  void lat;
  void lng;
  // 表示はフレンド公開範囲のみ（Issue #70 備考）
  return mockNearbyPosts.filter((p) => p.isFriendPost);
}

// GET /api/posts/:id 相当
export async function getPostById(id: string): Promise<NearbyPost | undefined> {
  await delay(200);
  return mockNearbyPosts.find((p) => p.id === id);
}

// POST /api/posts 相当（multipart）
export async function createPost(draft: { storeId: string; comment: string; pin: PinEmoji; imageUri: string | null }): Promise<NearbyPost> {
  await delay(500);
  const newPost: NearbyPost = {
    id: `p${mockNearbyPosts.length + 1}`,
    userName: mockMe.name || 'あなた',
    userInitial: (mockMe.name || 'あ').charAt(0),
    userColor: '#F4A259',
    storeName: draft.storeId,
    genreEmoji: draft.pin,
    comment: draft.comment,
    imageUri: draft.imageUri,
    isFriendPost: false,
    postedAt: new Date().toISOString(),
    distanceMeters: 0,
    isBookmarked: false,
    isMine: true,
    lat: 35.6595,
    lng: 139.7005,
  };
  mockNearbyPosts.unshift(newPost);
  return newPost;
}

// POST/DELETE /api/posts/:id/bookmark 相当
export async function toggleBookmark(postId: string): Promise<void> {
  await delay(200);
  const post = mockNearbyPosts.find((p) => p.id === postId);
  if (post) post.isBookmarked = !post.isBookmarked;
}

// DELETE /api/posts/:id 相当（本人のみ、PR #115でバックエンド実装中）
export async function deletePost(postId: string): Promise<void> {
  await delay(300);
  const index = mockNearbyPosts.findIndex((p) => p.id === postId);
  if (index !== -1) mockNearbyPosts.splice(index, 1);
}
