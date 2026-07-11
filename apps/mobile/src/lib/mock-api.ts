// apps/mobile/src/lib/mock-api.ts
//
// 🔧 モックAPIです。バックエンド未実装の機能はここに残し、実装済みのものは本物の fetch() に差し替えます。

import { Platform } from 'react-native';
import { apiFetch } from './api';
import { authClient } from './auth-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function rawApiFetch(path: string, init?: RequestInit): Promise<Response> {
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

// UI表示用の関係性ステータス。API の friendships.status ('pending'/'accepted'/'denied') とは別物、混同しないこと。
export type RelationshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

export type UserSearchResult = {
  id: string;
  name: string;
  handle: string;
  image: string | null;
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'request_denied';
  relationshipStatus: RelationshipStatus;
};

// GET /api/users/:handle 相当
export type UserProfile = {
  id: string;
  name: string;
  handle: string;
  image: string | null;
  bio: string | null;
  postCount: number;
  friendCount: number;
  relationshipStatus: RelationshipStatus;
};

export type FriendUser = {
  id: string;
  name: string;
  handle: string | null;
  image: string | null;
  bio: string | null;
};

// ---- 仮データ（本物のDBの代わり） ----
let mockMe: MeProfile = {
  id: 'mock-user-1',
  name: '',
  handle: null,
  bio: null,
  image: null,
};

const mockUserProfiles: (UserSearchResult & { bio: string | null; friendCount: number })[] = [
  {
    id: 'u1',
    name: 'Yuki Tanaka',
    handle: 'yuki_eats',
    image: null,
    relationshipStatus: 'pending_sent',
    bio: 'ラーメンとカフェ巡りが好き。週末は新店開拓。',
    friendCount: 12,
  },
  {
    id: 'u2',
    name: 'Ryo Sato',
    handle: 'ryo.food',
    image: null,
    relationshipStatus: 'none',
    bio: '寿司と日本酒が好きです。',
    friendCount: 8,
  },
  {
    id: 'u3',
    name: 'Aoi',
    handle: 'aoi_gohan',
    image: null,
    relationshipStatus: 'pending_received',
    bio: '中華料理が好きです。麻婆豆腐は必ずチェック。',
    friendCount: 5,
  },
  {
    id: 'u4',
    name: 'Takumi',
    handle: 'tkm.eats',
    image: null,
    relationshipStatus: 'friends',
    bio: 'おにぎりと点心が好き。',
    friendCount: 21,
  },
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

type ApiSearchUser = {
  id: string;
  name: string;
  handle: string | null;
  image: string | null;
  relationshipStatus: RelationshipStatus;
  friendshipId: number | null;
};

// GET /api/users/search?q=
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query.trim()) return [];
  const data = await apiFetch<{ users: ApiSearchUser[] }>(`/api/users/search?q=${encodeURIComponent(query)}`);
  return (data.users ?? []).map((u) => ({ ...u, handle: u.handle ?? '', friendshipStatus: u.relationshipStatus }));
}

// バックエンドにエンドポイントなし → 空配列（検索ファーストUX）
export async function getSuggestedUsers(): Promise<UserSearchResult[]> {
  return [];
}

// GET /api/me/friends
export async function getFriends(): Promise<FriendUser[]> {
  // ネイティブではcookieが自動送信されないため authClient.getCookie() で手動付与する
  // (better-auth expoクライアントの標準パターン)
  const cookie = authClient.getCookie();
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/me/friends`, {
    credentials: 'include',
    headers: cookie ? { Cookie: cookie } : undefined,
  });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error(`Failed to fetch friends (${res.status})`);
  return res.json();
}

// GET /api/users/check-handle?handle= 相当（未実装のためモック継続）
export async function checkHandleAvailable(handle: string): Promise<boolean> {
  await delay(300);
  void handle;
  return true;
}

// POST /api/friendships
export async function sendFriendRequest(userId: string): Promise<void> {
  await apiFetch('/api/friendships', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: userId }),
  });
  await delay(300);
  const target = mockUserProfiles.find((u) => u.id === userId);
  if (target) target.relationshipStatus = 'pending_sent';
}

// DELETE /api/friendships/:id 相当（送信済み申請の取消）
export async function cancelFriendRequest(userId: string): Promise<void> {
  await delay(300);
  const target = mockUserProfiles.find((u) => u.id === userId);
  if (target) target.relationshipStatus = 'none';
}

// PATCH /api/friendships/:id 相当（受信した申請の承認）
export async function acceptFriendRequest(userId: string): Promise<void> {
  await delay(300);
  const target = mockUserProfiles.find((u) => u.id === userId);
  if (target) {
    target.relationshipStatus = 'friends';
    target.friendCount += 1;
  }
}

// GET /api/users/:handle 相当。非公開プロフィールは本物のAPIでは404を返す方針（Issue #78 備考）
export async function getUserProfile(handle: string): Promise<UserProfile | undefined> {
  await delay(300);
  const h = handle.toLowerCase().replace('@', '');
  const user = mockUserProfiles.find((u) => u.handle.toLowerCase() === h);
  if (!user) return undefined;
  return {
    id: user.id,
    name: user.name,
    handle: user.handle,
    image: user.image,
    bio: user.bio,
    postCount: mockNearbyPosts.filter((p) => p.userName === user.name).length,
    friendCount: user.friendCount,
    relationshipStatus: user.relationshipStatus,
  };
}

// GET /api/users/:handle/posts 相当（投稿アルバム用）
export async function getUserPosts(handle: string): Promise<NearbyPost[]> {
  await delay(300);
  const h = handle.toLowerCase().replace('@', '');
  const user = mockUserProfiles.find((u) => u.handle.toLowerCase() === h);
  if (!user) return [];
  return mockNearbyPosts.filter((p) => p.userName === user.name);
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
  const res = await rawApiFetch('/api/me/friend-requests?direction=received');
  if (!res.ok) throw new Error(`failed to fetch friend requests: ${res.status}`);
  return res.json();
}

// PATCH /api/friendships/:id
export async function updateFriendshipRequest(friendshipId: number, data: { status: 'accepted' | 'denied' }): Promise<void> {
  const res = await rawApiFetch(`/api/friendships/${friendshipId}`, {
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
    isBookmarked: true,
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
    isBookmarked: true,
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
  // 自分プロフィールのアルバム表示デモ用（FE-14）
  {
    id: 'p11',
    userName: 'Takumi',
    userInitial: 'T',
    userColor: '#B85C5C',
    storeName: '喫茶ひとやすみ',
    genreEmoji: '🍰',
    comment: 'プリンアラモードが懐かしい味',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-05T14:20:00+09:00',
    distanceMeters: 200,
    isBookmarked: false,
    isMine: true,
  },
  {
    id: 'p12',
    userName: 'Takumi',
    userInitial: 'T',
    userColor: '#B85C5C',
    storeName: '中華そば 大和',
    genreEmoji: '🍜',
    comment: '朝ラー最高',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-04T09:10:00+09:00',
    distanceMeters: 600,
    isBookmarked: false,
    isMine: true,
  },
  {
    id: 'p13',
    userName: 'Takumi',
    userInitial: 'T',
    userColor: '#B85C5C',
    storeName: '角打ち酒場 星',
    genreEmoji: '🍺',
    comment: 'ハイボールが染みる',
    imageUri: null,
    isFriendPost: false,
    postedAt: '2026-07-03T21:00:00+09:00',
    distanceMeters: 690,
    isBookmarked: false,
    isMine: true,
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

// 保存した順（bookmarks.createdAt相当）を仮データ上で再現するための記録。本物はDBのbookmarksテーブルが持つ。
const bookmarkedAtByPostId = new Map<string, number>(mockNearbyPosts.filter((p) => p.isBookmarked).map((p, index) => [p.id, index]));

// 保存済み一覧画面が実際に使うフィールドのみの型。GET /api/me/bookmarks が返す形に合わせやすくするため、
// distanceMeters/lat/lng など保存一覧に不要な NearbyPost のフィールドを持ち込まない。
// 画面側の契約型は SavedPostItem（saved-posts.ts）。フィールド構成はそれと揃えてある。
export type BookmarkedPost = Pick<NearbyPost, 'id' | 'storeName' | 'genreEmoji' | 'imageUri' | 'userName' | 'postedAt' | 'comment'>;

// GET /api/me/bookmarks 相当。実APIは投稿日時ではなく「保存した日時」の降順で返す。
export async function getBookmarkedPosts(): Promise<BookmarkedPost[]> {
  await delay(300);
  return mockNearbyPosts.filter((p) => p.isBookmarked).sort((a, b) => (bookmarkedAtByPostId.get(b.id) ?? 0) - (bookmarkedAtByPostId.get(a.id) ?? 0));
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
  if (!post) return;
  post.isBookmarked = !post.isBookmarked;
  if (post.isBookmarked) {
    bookmarkedAtByPostId.set(postId, Date.now());
  } else {
    bookmarkedAtByPostId.delete(postId);
  }
}

// DELETE /api/posts/:id 相当（本人のみ、PR #115でバックエンド実装中）
export async function deletePost(postId: string): Promise<void> {
  await delay(300);
  const index = mockNearbyPosts.findIndex((p) => p.id === postId);
  if (index !== -1) mockNearbyPosts.splice(index, 1);
}

// 自分のプロフィール画面（FE-14）表示用の集計値。フロント内部用の型（本物のAPIに /api/me/summary は無い）。
// Step2で確定した方針：新規エンドポイントは作らず、既存3本の件数(.length)から組み立てる。
//   postsCount           <- GET /api/me/posts の件数
//   friendsCount          <- GET /api/me/friends の件数
//   pendingReceivedCount <- GET /api/me/friend-requests?direction=received の件数
// ProfileView が表示しない pendingSentCount・bookmarkedCount は持たない（使う画面ができたら追加する）。
export type MyProfileSummary = {
  postsCount: number;
  friendsCount: number;
  pendingReceivedCount: number;
};

// TODO(Step3): Promise.all で /api/me/posts・/api/me/friends・/api/me/friend-requests?direction=received を叩き、
// 各配列の .length からこの形を組み立てる fetch 実装に差し替える。
export async function getMyProfileSummary(): Promise<MyProfileSummary> {
  await delay(200);
  return {
    postsCount: mockNearbyPosts.filter((p) => p.isMine).length,
    friendsCount: 184,
    pendingReceivedCount: 2,
  };
}

// アルバムグリッド表示に必要な最小限のみ持つフロント内部用の型。
// NearbyPost をそのまま使うと距離・公開範囲などアルバムに不要な項目まで本物APIの形に見えてしまうため分離。
// 本物の GET /api/me/posts は { id: number, imageUrl: string | null, comment, pin, shop, createdAt, updatedAt } を返す
// （apps/api/src/routes/me.ts）。id は number、画像フィールド名は imageUri でなく imageUrl。
// TODO(Step3): 本物のAPIに差し替えるとき、id を number にし imageUrl -> imageUri へ詰め替える（他のモック投稿型との命名統一のため）。
export type ProfileAlbumPost = {
  id: string;
  imageUri: string | null;
};

// GET /api/me/posts 相当（自分の投稿アルバム）
export async function getMyPosts(): Promise<ProfileAlbumPost[]> {
  await delay(200);
  return mockNearbyPosts.filter((p) => p.isMine).map((p) => ({ id: p.id, imageUri: p.imageUri }));
}
