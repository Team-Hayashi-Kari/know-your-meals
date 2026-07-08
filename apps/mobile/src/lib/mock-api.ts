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
