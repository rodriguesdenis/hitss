import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { PinoLogger } from 'nestjs-pino';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { createAuth } from './auth.factory';
import { BetterAuthPasswordHasher, PasswordHasher } from './password-hasher';

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
 * and the global guard is registered in order by T-001-08.
 */
@Module({
  imports: [
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
        bodyParser: {
          json: { limit: '100kb' },
          urlencoded: { enabled: false },
        },
      }),
      disableGlobalAuthGuard: true,
    }),
  ],
})
export class IdentityModule {}
