// /saved 画面用のデータ整形。
// GET /api/me/bookmarks（BookmarkedPost）とモック（mock-api.ts）の命名差分をここに閉じ込め、
// 画面側は shop.name / author.name のようなAPI構造を直接知らなくてよいようにする。

import type { BookmarkedPost, PinEmoji } from '@repo/api-types';

export type SavedPostItem = {
  id: string;
  storeName: string;
  genreEmoji: PinEmoji;
  imageUri: string | null;
  userName: string;
  postedAt: string;
  comment: string;
};

export function toSavedPostItem(apiPost: BookmarkedPost): SavedPostItem {
  return {
    id: String(apiPost.id),
    storeName: apiPost.shop.name,
    genreEmoji: apiPost.pin,
    imageUri: apiPost.imageUrl,
    userName: apiPost.author.name,
    postedAt: apiPost.createdAt,
    comment: apiPost.comment ?? '',
  };
}
