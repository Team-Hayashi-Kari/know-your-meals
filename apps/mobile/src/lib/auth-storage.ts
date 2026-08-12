import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-storeはweb非対応。better-authはweb側でcookieにフォールバックするため、no-opで問題ない。
export const authStorage = {
  getItem: (key: string): string | null => {
    if (Platform.OS === 'web') return null;
    return SecureStore.getItem(key);
  },
  setItem: (key: string, value: string): void | Promise<void> => {
    if (Platform.OS === 'web') return;
    return SecureStore.setItemAsync(key, value);
  },
};
