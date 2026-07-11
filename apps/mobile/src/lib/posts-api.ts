// apps/mobile/src/lib/posts-api.ts
//
// /api/posts 系（作成・詳細取得・削除・ブックマーク）の実APIクライアント。要認証。

import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { getMe } from './api';
import { ApiError, apiFetch, buildApiUrl } from './api-client';
import type { NearbyPost, PinEmoji } from './mock-api';

export type CreatePostInput = {
  shop: { googlePlaceId: string; name: string; address: string; lat: number; lng: number };
  comment?: string;
  pin: string;
  image: Blob;
};

export type CreatedPost = {
  id: number;
  comment: string | null;
  pin: string;
  createdAt: string;
  shop: { id: number; googlePlaceId: string; name: string; address: string | null; lat: number; lng: number };
  image: { id: number; url: string };
};

export async function createPost(input: CreatePostInput): Promise<CreatedPost> {
  const formData = new FormData();
  formData.append('shop', JSON.stringify(input.shop));
  if (input.comment) formData.append('comment', input.comment);
  formData.append('pin', input.pin);
  formData.append('image', input.image, 'photo.jpg');

  const url = new URL('/api/posts', process.env.EXPO_PUBLIC_API_URL);
  const response = await fetch(url.toString(), { method: 'POST', credentials: 'include', body: formData });
  if (!response.ok) throw new Error(`Post creation failed: ${response.status}`);

  const data = (await response.json()) as { post: CreatedPost };
  return data.post;
}

type PostDetailResponse = {
  id: number;
  userId: string;
  comment: string | null;
  pin: PinEmoji;
  createdAt: string;
  updatedAt: string;
  shop: { id: number; googlePlaceId: string; name: string; address: string | null; lat: number; lng: number };
  author: { id: string; handle: string | null; name: string; image: string | null };
  imageUrl: string | null;
  isBookmarked: boolean;
};

// GET /api/posts/:id 相当。自分の投稿でもフレンドの投稿でもない、または存在しない場合は undefined
export async function getPostById(id: string): Promise<NearbyPost | undefined> {
  try {
    const [post, me] = await Promise.all([apiFetch<PostDetailResponse>(`/api/posts/${id}`), getMe()]);
    return {
      id: String(post.id),
      userName: post.author.name,
      userInitial: getAvatarInitial(post.author.name),
      userColor: getAvatarColor(post.author.name),
      storeName: post.shop.name,
      genreEmoji: post.pin,
      comment: post.comment ?? '',
      imageUri: post.imageUrl ? buildApiUrl(post.imageUrl) : null,
      isFriendPost: post.author.id !== me.id,
      postedAt: post.createdAt,
      // 現在地との距離計算はマップ画面(Task1)担当範囲。投稿詳細単体では現在地を持たないためプレースホルダー
      distanceMeters: 0,
      isBookmarked: post.isBookmarked,
      isMine: post.author.id === me.id,
      lat: post.shop.lat,
      lng: post.shop.lng,
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

// POST /api/posts/:id/bookmark 相当
export async function addBookmark(postId: string): Promise<void> {
  await apiFetch(`/api/posts/${postId}/bookmark`, { method: 'POST' });
}

// DELETE /api/posts/:id/bookmark 相当
export async function removeBookmark(postId: string): Promise<void> {
  await apiFetch(`/api/posts/${postId}/bookmark`, { method: 'DELETE' });
}

// DELETE /api/posts/:id 相当（本人のみ）
export async function deletePost(postId: string): Promise<void> {
  await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
}
