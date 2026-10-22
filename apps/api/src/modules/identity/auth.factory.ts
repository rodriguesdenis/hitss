import { randomUUID } from 'node:crypto';
import { expo } from '@better-auth/expo';
import { type Auth, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import type { AppConfig } from '../../config/app-config';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { createAuthLogger } from '../../shared/observability/logging/pino-bridge';
import { DISABLED_AUTH_PATHS } from './auth-routes';
import { authInputHook } from './hooks/auth-input.hook';
import { CLIENT_IP_HEADER } from './middleware/client-ip.middleware';
import type { PasswordHasher } from './password-hasher';

type AuthLoggerTarget = Parameters<typeof createAuthLogger>[0];

export const AUTH_BASE_PATH = '/api/auth';
const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7;
const SESSION_UPDATE_AGE = 60 * 60 * 24;

const CREDENTIAL_RULE = { window: 60, max: 10 };

export function trustedOrigins(
  config: Pick<AppConfig, 'appScheme' | 'appEnv' | 'corsOrigins'>,
): string[] {
  return [
    `${config.appScheme}://`,
    ...(config.appEnv === 'local' ? ['exp://'] : []),
    ...config.corsOrigins.filter((origin) => origin !== '*'),
  ];
}

function summarize(error: unknown): { name: string; code?: string } {
  const name = error instanceof Error ? error.name : typeof error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
  return typeof code === 'string' ? { name, code } : { name };
}

export type AuthInstance = Pick<Auth, 'handler' | 'api' | 'options'>;

export interface CreateAuthOptions {
  fixedUserId?: string;
}

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
    disabledPaths: [...DISABLED_AUTH_PATHS],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      password: {
        hash: (password) => passwordHasher.hash(password),
        verify: (data) => passwordHasher.verify(data),
      },
    },
    session: { expiresIn: SESSION_EXPIRES_IN, updateAge: SESSION_UPDATE_AGE },
    trustedOrigins: trustedOrigins(config),
    plugins: [bearer({ requireSignature: true }), expo()],
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
      disableOriginCheck: false,
      disableCSRFCheck: false,
      database: {
        generateId: options.fixedUserId
          ? ({ model }: { model: string }) =>
              model === 'user' ? (options.fixedUserId as string) : randomUUID()
          : 'uuid',
      },
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      useSecureCookies: config.appEnv === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
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
    hooks: { before: authInputHook },
  });
}
