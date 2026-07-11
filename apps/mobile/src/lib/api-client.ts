import { Platform } from 'react-native';
import { authClient } from './auth-client';

const baseURL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Web はブラウザの Cookie ジャーが自動送信するので credentials:'include' で足りる
// (fetch は "Cookie" ヘッダを手動セットできない = forbidden header、ブラウザが黙って無視する)。
// ネイティブ(Expoアプリ)はブラウザの Cookie ジャーが無いので authClient.getCookie() で手動添付する。
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseURL}${path}`, {
      ...init,
      credentials: Platform.OS === 'web' ? 'include' : undefined,
      headers: {
        ...init?.headers,
        ...(Platform.OS !== 'web' ? { Cookie: authClient.getCookie() } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    throw new ApiError(0, `Network error: ${message}`);
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
