import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';

const ENCRYPTION_KEY_NAME = 'mmkv-auth-encryption-key';

let mmkv: MMKV | null = null;

function generateEncryptionKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * ponytail: SecureStore で暗号化キーを守り、MMKV でセッションを同期読み書きする。
 * Web は localStorage（better-auth/expo が web では storage をほぼ使わないため許容）。
 * アプリ起動時に一度だけ呼ぶこと。
 */
export async function initAuthStorage(): Promise<void> {
  if (Platform.OS === 'web') return;

  let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);
  if (!key) {
    key = generateEncryptionKey();
    await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, key);
  }

  mmkv = new MMKV({ id: 'auth', encryptionKey: key });
}

export const authStorage = {
  getItem: (key: string): string | null => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return mmkv?.getString(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    mmkv?.set(key, value);
  },
};
