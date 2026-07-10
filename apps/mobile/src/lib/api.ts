import { authClient } from './auth-client';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookie = authClient.getCookie();
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
}
