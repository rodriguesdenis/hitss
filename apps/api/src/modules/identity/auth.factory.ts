import { randomUUID } from 'node:crypto';
import { expo } from '@better-auth/expo';
import { type Auth, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import type { AppConfig } from '../../config/app-config';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { createAuthLogger } from '../../shared/observability/logging/pino-bridge';
import { DISABLED_AUTH_PATHS } from './auth-routes';
import { CLIENT_IP_HEADER } from './middleware/client-ip.middleware';
import type { PasswordHasher } from './password-hasher';

type AuthLoggerTarget = Parameters<typeof createAuthLogger>[0];

export const AUTH_BASE_PATH = '/api/auth';
const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days (BR-01.4)
const SESSION_UPDATE_AGE = 60 * 60 * 24; // renewed once a day while used

/** Per client address and per endpoint (each its own bucket, AC-01.7.1). */
const CREDENTIAL_RULE = { window: 60, max: 10 };

/**
 * Origins Better Auth trusts for cookie-based auth calls: the app's deep-link scheme, Expo Go
 * (`exp://`) only when APP_ENV=local, and the web origins of CORS_ORIGINS. A local `*` is never
 * trusted: Better Auth would then accept any origin and the sign-in origin check (AC-01.2.8)
 * would vanish.
 */
export function trustedOrigins(
  config: Pick<AppConfig, 'appScheme' | 'appEnv' | 'corsOrigins'>,
): string[] {
  return [
    `${config.appScheme}://`,
    ...(config.appEnv === 'local' ? ['exp://'] : []),
    ...config.corsOrigins.filter((origin) => origin !== '*'),
  ];
}

/** `{ name, code }` of an unexpected error: driver and Prisma messages can carry row values. */
function summarize(error: unknown): { name: string; code?: string } {
  const name = error instanceof Error ? error.name : typeof error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
  return typeof code === 'string' ? { name, code } : { name };
}

/**
 * What the app uses of the Better Auth instance. A named type keeps declaration emit portable:
 * the fully inferred type references plugin internals (zod) that cannot be named.
 */
export type AuthInstance = Pick<Auth, 'handler' | 'api' | 'options'>;

export interface CreateAuthOptions {
  /**
   * Gives the next created user this id (the demo seed, T-007-07). Every other id stays a random
   * UUID. A user id returned from `databaseHooks.user.create.before` is dropped by the Prisma
   * adapter on PostgreSQL, so the id generator is the supported way.
   */
  fixedUserId?: string;
}

/** The Better Auth instance mounted at /api/auth (ADR-0007, plan 001 → Better Auth configuration). */
export function createAuth(
  config: AppConfig,
  prisma: PrismaService,
  logger: AuthLoggerTarget,
  passwordHasher: PasswordHasher,
  options: CreateAuthOptions = {},
): AuthInstance {
  return betterAuth({
    appName: 'Teams & Tasks',
    baseURL: config.betterAuthUrl,
    secret: config.betterAuthSecret,
    basePath: AUTH_BASE_PATH,
    // Only sign-up, sign-in, sign-out and get-session are served (auth-routes.ts).
    disabledPaths: [...DISABLED_AUTH_PATHS],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      // Bound closures: Better Auth calls these detached from their object.
      password: {
        hash: (password) => passwordHasher.hash(password),
        verify: (data) => passwordHasher.verify(data),
      },
    },
    session: { expiresIn: SESSION_EXPIRES_IN, updateAge: SESSION_UPDATE_AGE },
    trustedOrigins: trustedOrigins(config),
    plugins: [bearer({ requireSignature: true }), expo()],
    // Better Auth's limiter, per client address (x-tt-client-ip) and endpoint: credential routes
    // 10/min each; get-session (and anything else) 100/min (AC-01.7.7). The custom rules also
    // replace Better Auth's built-in 3-per-10 s rule for sign-in and sign-up.
    rateLimit: {
      enabled: config.authRateLimitEnabled,
      window: 60,
      max: 100,
      storage: 'memory',
      customRules: {
        '/sign-in/email': CREDENTIAL_RULE,
        '/sign-up/email': CREDENTIAL_RULE,
        '/sign-out': CREDENTIAL_RULE,
      },
    },
    advanced: {
      // Explicit: Better Auth skips both checks by default when NODE_ENV=test, so the e2e suite
      // would not exercise what production runs (AC-01.2.8).
      disableOriginCheck: false,
      disableCSRFCheck: false,
      database: {
        generateId: options.fixedUserId
          ? ({ model }: { model: string }) =>
              model === 'user' ? (options.fixedUserId as string) : randomUUID()
          : 'uuid',
      },
      // Written only by clientIpMiddleware (any client-sent value is dropped first, AC-01.7.6).
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      useSecureCookies: config.appEnv === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
    // Unexpected failures answer Better Auth's generic 500; the log keeps only { name, code } (S-L7).
    onAPIError: {
      throw: false,
      onError: (error) => {
        logger.error(
          { source: 'better-auth', err: summarize(error) },
          'auth.request.failed',
        );
      },
    },
    logger: createAuthLogger(logger, 'warn'),
  });
}
