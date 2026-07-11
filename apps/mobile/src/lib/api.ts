import type { Me } from '@repo/api-types';
import { ApiError, apiFetch } from './api-client';

export { apiFetch } from './api-client';

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
