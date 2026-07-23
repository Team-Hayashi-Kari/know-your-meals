import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const authStorage = {
  getItem: (key: string): string | null => {
    if (Platform.OS === 'web') return null;
    return SecureStore.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (Platform.OS === 'web') return;
    SecureStore.setItem(key, value);
  },
};
