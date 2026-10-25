import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { env } from '@/lib/env';

import { AUTH_STORAGE_PREFIX, getToken, setToken } from './token';

export const authClient = createAuthClient({
  baseURL: env.apiUrl,
  plugins: [
    expoClient({
      scheme: 'teamstasks',
      storagePrefix: AUTH_STORAGE_PREFIX,
      storage: SecureStore,
    }),
  ],
  fetchOptions: {
    auth: {
      type: 'Bearer',
      token: async () => (await getToken()) ?? undefined,
    },
    onSuccess: async ({ response }) => {
      const token = response.headers.get('set-auth-token');
      if (token) {
        await setToken(token);
      }
    },
  },
});

export function refreshSession(): void {
  authClient.$store.notify('$sessionSignal');
}
