import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Response headers the mobile app and web clients read (ETag, Location, auth token, …). */
export const EXPOSED_HEADERS = [
  'set-auth-token',
  'ETag',
  'Location',
  'X-Request-Id',
  'Retry-After',
  'Idempotent-Replayed',
];

/**
 * CORS from CORS_ORIGINS (validated by the config; `*` is refused in production).
 * - An allowlist answers only listed origins, with credentials, so cookie sessions work.
 * - `*` (local only) answers a literal `*` without credentials: the request `Origin` is never
 *   reflected together with `Access-Control-Allow-Credentials: true` (PR #19 review).
 */
export function corsOptions(origins: readonly string[]): CorsOptions {
  return origins.includes('*')
    ? { origin: '*', credentials: false, exposedHeaders: EXPOSED_HEADERS }
    : {
        origin: [...origins],
        credentials: true,
        exposedHeaders: EXPOSED_HEADERS,
      };
}
