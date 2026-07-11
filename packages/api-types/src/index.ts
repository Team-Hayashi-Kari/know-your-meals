// GET /api/me のレスポンス型（apps/api/src/routes/me.ts の profileSelect と揃える）
export type Me = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  handle: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
};

// GET /api/me/bookmarks の shop / author（apps/api/src/routes/me.ts と揃える）
export type ShopSummary = {
  id: number;
  googlePlaceId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
};

export type PostAuthor = {
  id: string;
  handle: string | null;
  name: string;
  image: string | null;
};

// GET /api/me/friend-requests?direction=sent の1件分のレスポンス型
export type SentFriendRequest = {
  friendshipId: number;
  requestedAt: string;
  id: string;
  handle: string | null;
  name: string;
  image: string | null;
  bio: string | null;
};

// GET /api/me/bookmarks のレスポンス型（apps/api/src/routes/me.ts の .get('/bookmarks', ...) と揃える）
// bookmarkId / bookmarkedAt は含めない（仕様上返さない）
export type PinEmoji = '🍜' | '🍣' | '🍛' | '🍙' | '🍔' | '🍕' | '🥩' | '🍰' | '🍺' | '🥟';

export type BookmarkedPost = {
  id: number;
  comment: string | null;
  pin: PinEmoji;
  createdAt: string;
  updatedAt: string;
  imageUrl: string | null;
  shop: ShopSummary;
  author: PostAuthor;
};
