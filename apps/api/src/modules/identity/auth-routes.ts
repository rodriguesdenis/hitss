import type { IncomingMessage, ServerResponse } from 'node:http';

/** The only Better Auth routes the API serves (spec 001: email and password, sign-out, session). */
export const ALLOWED_AUTH_PATHS: readonly string[] = [
  '/sign-up/email',
  '/sign-in/email',
  '/sign-out',
  '/get-session',
];

/**
 * Better Auth's `disabledPaths`: every other route of this configuration (core, bearer, Expo),
 * answering 404. A unit test compares it with the instance's endpoints, so a Better Auth upgrade
 * that adds a route fails until the route is listed here. Better Auth matches these exactly, so
 * routes with parameters (`/callback/:id`, `/reset-password/:token`) are closed by
 * `authRouteAllowlist` below instead.
 */
export const DISABLED_AUTH_PATHS: readonly string[] = [
  '/account-info',
  '/change-email',
  '/change-password',
  '/delete-user',
  '/delete-user/callback',
  '/error',
  '/expo-authorization-proxy',
  '/get-access-token',
  '/link-social',
  '/list-accounts',
  '/list-sessions',
  '/ok',
  '/refresh-token',
  '/request-password-reset',
  '/reset-password',
  '/revoke-other-sessions',
  '/revoke-session',
  '/revoke-sessions',
  '/send-verification-email',
  '/sign-in/social',
  '/unlink-account',
  '/update-session',
  '/update-user',
  '/verify-email',
  '/verify-password',
];

/**
 * Runs in front of the Better Auth handler (AuthModule `middleware` option) and answers 404, as
 * `disabledPaths` does, for any auth path that is not allowed: parameterized routes and routes a
 * future version adds are closed by default. The path is compared after URL normalization, the
 * same parsing Better Auth routes on.
 */
export function authRouteAllowlist(basePath: string) {
  const allowed = new Set(
    ALLOWED_AUTH_PATHS.map((path) => `${basePath}${path}`),
  );
  return (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ): void => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (allowed.has(pathname)) {
      next();
      return;
    }
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain;charset=UTF-8');
    response.end('Not Found');
  };
}
