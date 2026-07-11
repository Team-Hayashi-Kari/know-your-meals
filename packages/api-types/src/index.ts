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
