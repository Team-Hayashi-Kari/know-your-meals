import { authClient } from './auth-client';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

type FetchResult<T> = { data: T; error: null } | { data: null; error: { message?: string; status: number } };

// authClient.$fetch runs the expoClient fetchPlugin which attaches the session cookie automatically.
// Pass absolute URL so BetterFetch skips its internal baseURL (/api/auth) prefix.
export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const result = (await (authClient.$fetch as (url: string, opts?: unknown) => Promise<FetchResult<T>>)(`${BASE}${path}`, init)) as FetchResult<T>;
  if (result.error !== null) throw new Error(result.error.message ?? `HTTP ${result.error.status}`);
  return result.data as T;
}
