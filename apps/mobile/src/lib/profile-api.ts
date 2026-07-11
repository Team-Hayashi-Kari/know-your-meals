// apps/mobile/src/lib/profile-api.ts
//
// プロフィール画面（FE-14）用の実APIクライアント。
// better-auth のセッションCookieで認証される。
// Web は credentials:'include' でブラウザのCookieが自動送信されるが、
// Native (iOS/Android) の fetch にはCookie jarが無いため、
// expoClient が SecureStore に保存した Cookie を authClient.getCookie() で明示的に付与する。
import { Platform } from 'react-native';
import { authClient } from './auth-client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set');
  }

  const cookie = Platform.OS === 'web' ? '' : authClient.getCookie();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: cookie ? { cookie } : undefined,
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// GET /api/images/... の相対パスを表示可能な絶対URLにする
export function toAbsoluteApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE_URL ?? ''}${path}`;
}

// GET /api/me のレスポンス（表示に使う分のみ）
export type MeProfile = {
  id: string;
  name: string;
  handle: string | null;
  bio: string | null;
  image: string | null;
};

export function getMe(): Promise<MeProfile> {
  return apiFetch<MeProfile>('/api/me');
}

type FriendUser = {
  id: string;
  handle: string | null;
  name: string;
  image: string | null;
  bio: string | null;
};

export function getMyFriends(): Promise<FriendUser[]> {
  return apiFetch<FriendUser[]>('/api/me/friends');
}

type ReceivedFriendRequest = {
  friendshipId: number;
} & FriendUser & { mutualFriendCount: number };

export function getMyReceivedFriendRequests(): Promise<ReceivedFriendRequest[]> {
  return apiFetch<ReceivedFriendRequest[]>('/api/me/friend-requests?direction=received');
}

// GET /api/me/posts のレスポンス（apps/api/src/routes/me.ts 参照）
export type MyPost = {
  id: number;
  comment: string | null;
  pin: string;
  createdAt: string;
  updatedAt: string;
  imageUrl: string | null;
  shop: {
    id: number;
    googlePlaceId: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
  };
};

export function getMyPosts(): Promise<MyPost[]> {
  return apiFetch<MyPost[]>('/api/me/posts');
}
