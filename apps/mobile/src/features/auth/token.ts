import * as SecureStore from 'expo-secure-store';

export const AUTH_STORAGE_PREFIX = 'teamstasks';

export const TOKEN_KEY = `${AUTH_STORAGE_PREFIX}.session-token`;

const authClientKeys = [
  `${AUTH_STORAGE_PREFIX}_cookie`,
  `${AUTH_STORAGE_PREFIX}_session_data`,
];

export function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function deleteToken(): Promise<void> {
  await Promise.all(
    [TOKEN_KEY, ...authClientKeys].map((key) =>
      SecureStore.deleteItemAsync(key),
    ),
  );
}
