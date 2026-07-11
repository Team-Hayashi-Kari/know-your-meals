// apps/mobile/src/lib/api.ts
//
// 本番 API (apps/api) への fetch ラッパー。Issue #78 / FE-16。
// Web は credentials: 'include' でブラウザCookieを送信し、Native は better-auth expo の Cookie を手動付与する。

import type { BookmarkedPost, Me } from '@repo/api-types';
import { Platform } from 'react-native';
import { authClient } from './auth-client';
import { type SavedPostItem, toSavedPostItem } from './saved-posts';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message?: string) {
    super(message ?? `API error ${status}`);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (Platform.OS !== 'web') {
    headers.set('Cookie', authClient.getCookie());
  }

  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: Platform.OS === 'web' ? 'include' : init?.credentials,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body as { error?: string } | null)?.error);
  }

  return res.json() as Promise<T>;
}

// UI表示用の関係性ステータス。API の friendships.status ('pending'/'accepted'/'denied') とは別物、混同しないこと。
export type RelationshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

export type UserSearchResult = {
  id: string;
  name: string;
  handle: string;
  image: string | null;
  relationshipStatus: RelationshipStatus;
  friendshipId: number | null;
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
  friendshipId: number | null;
};

// GET /api/users/:handle/posts 相当
export type ProfilePost = {
  id: number;
  pin: string;
  createdAt: string;
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

// GET /api/users/:handle 相当。存在しない handle は 404 として undefined を返す
export async function getUserProfile(handle: string): Promise<UserProfile | undefined> {
  try {
    return await apiFetch<UserProfile>(`/api/users/${encodeURIComponent(handle)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

// GET /api/users/:handle/posts 相当
export async function getUserPosts(handle: string): Promise<ProfilePost[]> {
  const data = await apiFetch<{ posts: ProfilePost[]; nextPage: number | null }>(`/api/users/${encodeURIComponent(handle)}/posts`);
  return data.posts;
}

// GET /api/users/search?q= 相当
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const data = await apiFetch<{ users: UserSearchResult[]; nextPage: number | null }>(`/api/users/search?q=${encodeURIComponent(query)}`);
  return data.users;
}

// POST /api/friendships 相当。user.id を使う（friendshipId ではない）
export async function sendFriendRequest(userId: string): Promise<void> {
  await apiFetch('/api/friendships', { method: 'POST', body: JSON.stringify({ id: userId }) });
}

// DELETE /api/friendships/:id 相当（送信済み申請の取消）。friendshipId を使う
export async function cancelFriendRequest(friendshipId: number): Promise<void> {
  await apiFetch(`/api/friendships/${friendshipId}`, { method: 'DELETE' });
}

// PATCH /api/friendships/:id 相当（受信した申請の承認）。friendshipId を使う
export async function acceptFriendRequest(friendshipId: number): Promise<void> {
  await apiFetch(`/api/friendships/${friendshipId}`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) });
}

type UpdateMeInput = Partial<Pick<Me, 'name' | 'handle' | 'bio' | 'image'>>;

// GET /api/me
export async function getMe(): Promise<Me> {
  return apiFetch<Me>('/api/me');
}

// PATCH /api/me
export async function updateMe(data: UpdateMeInput): Promise<Me> {
  return apiFetch<Me>('/api/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

// GET /api/me/bookmarks
export async function getBookmarkedPosts(): Promise<SavedPostItem[]> {
  const posts = await apiFetch<BookmarkedPost[]>('/api/me/bookmarks');
  return posts.map(toSavedPostItem);
}

// GET /api/users/:handle を流用して重複チェックする(404 なら空き、200 なら使用中)
export async function checkHandleAvailable(handle: string): Promise<boolean> {
  try {
    await apiFetch(`/api/users/${encodeURIComponent(handle)}`);
    return false;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return true;
    throw error;
  }
}
