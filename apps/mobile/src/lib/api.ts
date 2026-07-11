import type { Me, SentFriendRequest } from '@repo/api-types';
import { ApiError, apiFetch } from './api-client';

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

// GET /api/me/friend-requests?direction=sent
export async function getSentFriendRequests(): Promise<SentFriendRequest[]> {
  return apiFetch<SentFriendRequest[]>('/api/me/friend-requests?direction=sent');
}

// DELETE /api/friendships/:id（送信済みのフレンド申請を取消）
export async function cancelFriendRequest(friendshipId: number): Promise<void> {
  await apiFetch(`/api/friendships/${friendshipId}`, { method: 'DELETE' });
}
