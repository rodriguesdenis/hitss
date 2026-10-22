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

@Module({
  providers: [{ provide: PasswordHasher, useClass: BetterAuthPasswordHasher }],
  exports: [PasswordHasher],
})
export class PasswordHasherModule {}

@Module({
  imports: [
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
      disableGlobalAuthGuard: true,
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: IpThrottlerGuard },
    { provide: APP_GUARD, useClass: BearerAuthGuard },
    { provide: APP_GUARD, useClass: OwnerThrottlerGuard },
  ],
})
export class IdentityModule {}
