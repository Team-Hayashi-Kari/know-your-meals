// apps/mobile/src/lib/mock-api.ts
//
// 🔧 これはモック（仮の）APIです。
// バックエンドが完成したら、この中の実装だけを本物の fetch() 呼び出しに差し替えます。
// 関数名・引数・戻り値の型は API設計書（GET/PATCH /api/me など）に合わせてあります。

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

// POST /api/friendships 相当
export async function sendFriendRequest(userId: string): Promise<void> {
  await delay(300);
  const target = mockUsers.find((u) => u.id === userId);
  if (target) target.relationshipStatus = 'pending_sent';
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
  },
];

const mockBookmarkedPostIds = new Set<string>();

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
  };
  mockNearbyPosts.unshift(newPost);
  return newPost;
}

// POST/DELETE /api/posts/:id/bookmark 相当
export async function toggleBookmark(postId: string): Promise<void> {
  await delay(200);
  if (mockBookmarkedPostIds.has(postId)) {
    mockBookmarkedPostIds.delete(postId);
  } else {
    mockBookmarkedPostIds.add(postId);
  }
}
