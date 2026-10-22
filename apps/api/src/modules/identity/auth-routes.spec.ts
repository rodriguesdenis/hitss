import type { IncomingMessage, ServerResponse } from 'node:http';
import { toAppConfig } from '../../config/app-config';
import { validate } from '../../config/env.validation';
import { VALID_ENV } from '../../config/testing/expect-invalid';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AUTH_BASE_PATH, createAuth } from './auth.factory';
import {
  ALLOWED_AUTH_PATHS,
  authRouteAllowlist,
  DISABLED_AUTH_PATHS,
} from './auth-routes';
import { BetterAuthPasswordHasher } from './password-hasher';

const auth = createAuth(
  toAppConfig(validate(VALID_ENV)),
  {} as PrismaService,
  { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
  new BetterAuthPasswordHasher(),
);
const endpointPaths = Object.values(
  auth.api as Record<string, { path?: string }>,
)
  .map((endpoint) => endpoint.path)
  .filter((path): path is string => typeof path === 'string');

describe('Better Auth routes (Lynx MUST 1)', () => {
  it('every allowed path is a real endpoint', () => {
    expect(endpointPaths).toEqual(
      expect.arrayContaining([...ALLOWED_AUTH_PATHS]),
    );
  });

  it('disabledPaths lists every other endpoint without parameters (fails when an upgrade adds one)', () => {
    const expected = endpointPaths
      .filter(
        (path) => !path.includes(':') && !ALLOWED_AUTH_PATHS.includes(path),
      )
      .sort();

    expect([...DISABLED_AUTH_PATHS].sort()).toEqual(expected);
    expect(auth.options.disabledPaths).toEqual(DISABLED_AUTH_PATHS);
  });

  it('routes with parameters are never allowed (the allowlist closes them)', () => {
    const withParams = endpointPaths.filter((path) => path.includes(':'));

    expect(withParams.length).toBeGreaterThan(0);
    expect(
      withParams.filter((path) => ALLOWED_AUTH_PATHS.includes(path)),
    ).toEqual([]);
  });
});

describe('authRouteAllowlist', () => {
  const gate = authRouteAllowlist(AUTH_BASE_PATH);

  const run = (url: string) => {
    const next = jest.fn();
    const response = { statusCode: 200, setHeader: jest.fn(), end: jest.fn() };
    gate(
      { url } as IncomingMessage,
      response as unknown as ServerResponse,
      next,
    );
    return { next, response };
  };

  it.each([
    '/api/auth/sign-in/email',
    '/api/auth/get-session?disableCookieCache=true',
  ])('passes %s on to Better Auth', (url) => {
    const { next, response } = run(url);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.end).not.toHaveBeenCalled();
  });

  it.each([
    '/api/auth/update-user',
    '/api/auth/callback/github',
    '/api/auth/reset-password/some-token',
    '/api/auth/sign-in/email/../../update-user',
    '/api/auth/sign-in/email/',
    '/api/auth/Sign-In/email',
    '/api/auth',
  ])('answers 404 for %s without reaching Better Auth', (url) => {
    const { next, response } = run(url);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(404);
    expect(response.end).toHaveBeenCalledWith('Not Found');
  });
});
