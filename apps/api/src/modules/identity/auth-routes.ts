import type { IncomingMessage, ServerResponse } from 'node:http';

export const ALLOWED_AUTH_PATHS: readonly string[] = [
  '/sign-up/email',
  '/sign-in/email',
  '/sign-out',
  '/get-session',
];

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
