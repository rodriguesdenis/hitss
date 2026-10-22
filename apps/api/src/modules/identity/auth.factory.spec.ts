import { toAppConfig } from '../../config/app-config';
import { validate } from '../../config/env.validation';
import { VALID_ENV } from '../../config/testing/expect-invalid';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AUTH_BASE_PATH, createAuth, trustedOrigins } from './auth.factory';
import { defaultPasswordHasher } from './password-hasher';

const config = (env: Record<string, string> = {}) =>
  toAppConfig(validate({ ...VALID_ENV, ...env }));

const logger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

describe('trustedOrigins', () => {
  it('T-001-06 includes exp:// (Expo Go) only when APP_ENV=local', () => {
    expect(trustedOrigins(config({ APP_ENV: 'local' }))).toContain('exp://');
    expect(trustedOrigins(config({ APP_ENV: 'test' }))).not.toContain('exp://');
  });

  it('trusts the app scheme and the CORS origins', () => {
    expect(
      trustedOrigins(
        config({
          APP_ENV: 'test',
          APP_SCHEME: 'teamstasks',
          CORS_ORIGINS: 'https://app.example.test,http://localhost:8081',
        }),
      ),
    ).toEqual([
      'teamstasks://',
      'https://app.example.test',
      'http://localhost:8081',
    ]);
  });

  it('Lynx: never trusts * even when CORS_ORIGINS=* (sign-in origin check stays on)', () => {
    expect(
      trustedOrigins(
        config({ APP_ENV: 'local', CORS_ORIGINS: '*,http://localhost:8081' }),
      ),
    ).toEqual(['teamstasks://', 'exp://', 'http://localhost:8081']);
  });
});

describe('createAuth', () => {
  const auth = createAuth(
    config({ AUTH_RATE_LIMIT_ENABLED: 'false' }),
    {} as PrismaService,
    logger,
    defaultPasswordHasher,
  );
  const { options } = auth;

  it('mounts at /api/auth with email and password (8-128)', () => {
    expect(AUTH_BASE_PATH).toBe('/api/auth');
    expect(options.basePath).toBe('/api/auth');
    expect(options.emailAndPassword).toMatchObject({
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    });
  });

  it('T-001-06 creates UUID ids, 7-day sessions renewed after 1 day (BR-01.4)', () => {
    expect(options.advanced?.database?.generateId).toBe('uuid');
    expect(options.session).toMatchObject({
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    });
  });

  it('AC-01.2.8 keeps the origin and CSRF checks on in every environment (Better Auth skips them under NODE_ENV=test by default)', () => {
    expect(options.advanced).toMatchObject({
      disableOriginCheck: false,
      disableCSRFCheck: false,
    });
  });

  it('uses the signed bearer plugin and the Expo plugin', () => {
    expect(options.plugins?.map((plugin) => plugin.id)).toEqual([
      'bearer',
      'expo',
    ]);
  });

  it('takes the rate limiter switch from AUTH_RATE_LIMIT_ENABLED', () => {
    expect(options.rateLimit?.enabled).toBe(false);
    expect(
      createAuth(config(), {} as PrismaService, logger, defaultPasswordHasher)
        .options.rateLimit?.enabled,
    ).toBe(true);
  });

  it('hashes passwords with the injected hasher (Better Auth defaults in production)', () => {
    expect(options.emailAndPassword?.password).toEqual(defaultPasswordHasher);
  });

  it('S-L7: an unexpected auth error is logged with { name, code } only', async () => {
    await options.onAPIError?.onError?.(
      Object.assign(new Error('relation "users" DETAIL: marina@example.test'), {
        code: 'P1001',
      }),
      {} as never,
    );

    expect(logger.error).toHaveBeenCalledWith(
      { source: 'better-auth', err: { name: 'Error', code: 'P1001' } },
      'auth.request.failed',
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('marina');
    expect(options.onAPIError?.throw).toBe(false);
  });
});
