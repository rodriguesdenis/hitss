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

const CHUNK_MARKER = 'ba-chunks:';

export function chunkKeys(key: string, stored: string | null): string[] {
  if (!stored?.startsWith(CHUNK_MARKER)) {
    return [];
  }
  const [count, slot, fallback] = stored
    .slice(CHUNK_MARKER.length)
    .split(':')
    .map(Number);
  const range = (n: number | undefined, prefix: string) =>
    Number.isInteger(n) && n! > 0
      ? Array.from({ length: Math.min(n!, 100) }, (_, i) => `${prefix}.${i}`)
      : [];
  if (slot !== 0 && slot !== 1) {
    return range(count, key);
  }
  return [
    ...range(count, `${key}.${slot}`),
    ...range(fallback, `${key}.${slot === 0 ? 1 : 0}`),
  ];
}

export async function deleteToken(): Promise<void> {
  const chunks = await Promise.all(
    authClientKeys.map(async (key) =>
      chunkKeys(key, await SecureStore.getItemAsync(key)),
    ),
  );
  await Promise.all(
    [TOKEN_KEY, ...authClientKeys, ...chunks.flat()].map((key) =>
      SecureStore.deleteItemAsync(key),
    ),
  );
}
