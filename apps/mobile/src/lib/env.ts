import { z } from 'zod';

const apiUrl = (isDev: boolean) =>
  z
    .url({
      protocol: isDev ? /^https?$/ : /^https$/,
      error: (issue) =>
        issue.input === undefined
          ? 'EXPO_PUBLIC_API_URL is not set. Copy apps/mobile/.env.example to apps/mobile/.env and set the API origin.'
          : isDev
            ? 'EXPO_PUBLIC_API_URL must be an http(s) URL, e.g. http://192.168.0.10:3000.'
            : 'EXPO_PUBLIC_API_URL must use https outside development.',
    })
    .transform((url) => url.replace(/\/+$/, ''));

export type Env = { apiUrl: string };

export function parseEnv(
  source: { EXPO_PUBLIC_API_URL?: string },
  isDev: boolean,
): Env {
  const result = apiUrl(isDev).safeParse(source.EXPO_PUBLIC_API_URL);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message);
  }
  return { apiUrl: result.data };
}

export const env = parseEnv(
  { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL },
  __DEV__,
);
