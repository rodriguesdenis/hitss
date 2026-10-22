import { Module } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { PinoLogger } from 'nestjs-pino';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AUTH_BASE_PATH, createAuth } from './auth.factory';
import { authRouteAllowlist } from './auth-routes';
import { authBodyLimit } from './middleware/auth-body-limit.middleware';
import {
  ClientRequest,
  clientIpMiddleware,
} from './middleware/client-ip.middleware';
import { BetterAuthPasswordHasher, PasswordHasher } from './password-hasher';
import { BearerAuthGuard } from './presentation/bearer-auth.guard';
import { IpThrottlerGuard } from './presentation/ip-throttler.guard';
import {
  IP_THROTTLER,
  USER_THROTTLER,
} from './presentation/named-throttler.guard';
import { OwnerThrottlerGuard } from './presentation/owner-throttler.guard';

type Middleware = (
  request: ClientRequest,
  response: ServerResponse,
  next: () => void,
) => void;

/** Runs middleware in order; each one calls `next` to continue or answers to stop. */
function chain(...middleware: Middleware[]): Middleware {
  return (request, response, next) => {
    const run = (index: number): void => {
      const current = middleware[index];
      if (current) {
        current(request, response, () => run(index + 1));
      } else {
        next();
      }
    };
    run(0);
  };
}

/** Provides the password hasher to the auth factory; e2e tests override it to observe calls. */
@Module({
  providers: [{ provide: PasswordHasher, useClass: BetterAuthPasswordHasher }],
  exports: [PasswordHasher],
})
export class PasswordHasherModule {}

/**
 * Identity context (generic subdomain): Better Auth mounted at /api/auth, answering in its native
 * format (spec Q-01.1). Nest is created with `bodyParser: false`; this module re-adds the JSON
 * parser (100 kB, the API-wide limit) for every other route, with urlencoded bodies disabled.
 * CORS for auth routes is the app's own (setupApp), so the module's trusted-origins CORS is off,
 * and the global guards are registered here, in order: per-IP throttler, Bearer-only
 * authentication (deny by default; ADR-0020: a cookie never authenticates /api/v1, so there is no
 * CSRF guard), per-user throttler. A route opts out of authentication with `@Public()`.
 */
@Module({
  imports: [
    // Two named throttlers, one window of a minute each; the guards below pick theirs by name.
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          { name: IP_THROTTLER, ttl: 60_000, limit: config.rateLimitIpMax },
          { name: USER_THROTTLER, ttl: 60_000, limit: config.rateLimitMax },
        ],
      }),
    }),
    AuthModule.forRootAsync({
      imports: [PasswordHasherModule],
      inject: [APP_CONFIG, PrismaService, PinoLogger, PasswordHasher],
      useFactory: (
        config: AppConfig,
        prisma: PrismaService,
        logger: PinoLogger,
        passwordHasher: PasswordHasher,
      ) => ({
        auth: createAuth(config, prisma, logger.logger, passwordHasher),
        disableTrustedOriginsCors: true,
        // In front of the Better Auth handler (Nest middleware would run after it): any auth path
        // outside the allowlist answers 404, an oversized body 413 (before any hashing), then the client
        // address is set for the limiter.
        middleware: chain(
          authRouteAllowlist(AUTH_BASE_PATH),
          authBodyLimit(),
          clientIpMiddleware(config.trustedProxies.length > 0),
        ),
        bodyParser: {
          json: { limit: '100kb' },
          urlencoded: { enabled: false },
        },
      }),
      // Registered below instead, so the global guards run in the documented order.
      disableGlobalAuthGuard: true,
    }),
  ],
  // Global guards run in registration order: anonymous floods are bounded before any session
  // lookup, and the per-user limit needs the authenticated user.
  providers: [
    { provide: APP_GUARD, useClass: IpThrottlerGuard },
    { provide: APP_GUARD, useClass: BearerAuthGuard },
    { provide: APP_GUARD, useClass: OwnerThrottlerGuard },
  ],
})
export class IdentityModule {}
