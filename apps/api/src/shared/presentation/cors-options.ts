import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const EXPOSED_HEADERS = [
  'set-auth-token',
  'Location',
  'X-Request-Id',
  'Retry-After',
  'X-Retry-After',
  'Idempotent-Replayed',
];

export const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Idempotency-Key',
  'X-Request-Id',
];

export const PREFLIGHT_MAX_AGE = 600;

export function corsOptions(
  origins: readonly string[],
): CorsOptions | undefined {
  if (origins.length === 0) {
    return undefined;
  }
  return origins.includes('*')
    ? {
        origin: '*',
        credentials: false,
        allowedHeaders: ALLOWED_HEADERS,
        exposedHeaders: EXPOSED_HEADERS,
        maxAge: PREFLIGHT_MAX_AGE,
      }
    : {
        origin: [...origins],
        credentials: true,
        allowedHeaders: ALLOWED_HEADERS,
        exposedHeaders: EXPOSED_HEADERS,
        maxAge: PREFLIGHT_MAX_AGE,
      };
}
