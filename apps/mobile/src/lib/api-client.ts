// apps/mobile/src/lib/api-client.ts
//
// 本物のバックエンド（apps/api）を叩く fetch ラッパー。
// better-auth/expo はセッションCookieを SecureStore に保存するだけで、
// authClient 以外の fetch には自動で付与されないため、authClient.getCookie() で取り出して手動で付与する。
// Web は expo-secure-store が未実装（SecureStore.getItem が存在せずクラッシュする）ため、
// web では authClient.getCookie() を呼ばず、ブラウザの Cookie jar に任せて credentials: 'include' を使う
// （Cookie ヘッダーは仕様上ブラウザから手動設定できないので、これがないと web は毎回401になる）。

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
