import type { Me } from '@repo/api-types';
import { apiFetch } from './api-client';

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
