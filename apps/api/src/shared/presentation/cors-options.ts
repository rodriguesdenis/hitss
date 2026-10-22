import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Response headers the mobile app and web clients read (Location, auth token, …). */
export const EXPOSED_HEADERS = [
  'set-auth-token',
  'Location',
  'X-Request-Id',
  'Retry-After',
  'X-Retry-After', // Better Auth's limiter hint on /api/auth/* (AC-01.7.1)
  'Idempotent-Replayed',
];

/**
 * Request headers allowed cross-origin, in both modes (Lynx review of #36). Without a list the
 * `cors` package reflects whatever a preflight asks for; `expo-origin` in particular stays out,
 * because the Expo plugin turns it into an `Origin` that Better Auth's origin check trusts.
 */
export const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Idempotency-Key',
  'X-Request-Id',
];

/** Seconds browsers may cache a preflight answer (PR #29). */
export const PREFLIGHT_MAX_AGE = 600;

/**
 * CORS from CORS_ORIGINS (validated by the config; `*` is refused in production).
 * - An empty list means no CORS at all: nothing is registered, so no `Access-Control-*` header
 *   (not even Allow-Credentials) is sent and preflights are not answered (PR #29).
 * - An allowlist answers only listed origins, with credentials, so cookie sessions work, and
 *   only the request headers in ALLOWED_HEADERS (both modes: one header policy).
 * - `*` (local only) answers a literal `*` without credentials: the request `Origin` is never
 *   reflected together with `Access-Control-Allow-Credentials: true` (PR #19 review).
 */
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
