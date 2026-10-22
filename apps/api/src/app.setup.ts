import { INestApplication, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { APP_CONFIG, AppConfig } from './config/app-config';
import { requestIdMiddleware } from './shared/observability/logging/request-id';
import { corsOptions } from './shared/presentation/cors-options';
import { GlobalExceptionFilter } from './shared/presentation/filters/global-exception.filter';
import { EnvelopeInterceptor } from './shared/presentation/interceptors/envelope.interceptor';
import { AppValidationPipe } from './shared/presentation/pipes/validation.pipe';

/**
 * App-level configuration shared by `main.ts` and the e2e/integration test app, so both serve
 * the same HTTP conventions (ADR-0005). Order matters:
 * 1. pino logger, so every later log line (filter, Prisma, Nest) is JSON, redacted, correlated;
 * 2. shutdown hooks and Express `trust proxy` from TRUSTED_PROXIES;
 * 3. request id, registered before the body parser so even 413/400 parse errors carry it;
 * 4. helmet security headers (also removes X-Powered-By) and CORS from CORS_ORIGINS (none at
 *    all when the list is empty), before routing, so every response, 404s and parse errors
 *    included, carries them;
 * 5. `/api` prefix and URI versioning v1;
 * 6. validation pipe, `{ data }` envelope interceptor, `{ error }` exception filter.
 */
export function setupApp<T extends INestApplication>(app: T): T {
  app.useLogger(app.get(Logger));
  // SIGTERM/SIGINT run onModuleDestroy hooks, e.g. closing the Prisma pool (docker stop).
  app.enableShutdownHooks();
  const config = app.get<AppConfig>(APP_CONFIG);
  // TRUSTED_PROXIES (CIDRs) → Express `trust proxy`, so req.ip follows X-Forwarded-For only
  // through those proxies; with none, req.ip is the TCP peer (AC-01.7.6, AC-01.7.11).
  const express = app.getHttpAdapter().getInstance() as {
    set(setting: string, value: unknown): void;
  };
  express.set(
    'trust proxy',
    config.trustedProxies.length > 0 ? [...config.trustedProxies] : false,
  );
  app.use(requestIdMiddleware);
  app.use(helmet());
  const cors = corsOptions(config.corsOrigins);
  if (cors) {
    app.enableCors(cors);
  }
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalInterceptors(new EnvelopeInterceptor(app.get(Reflector)));
  // From the container: built with the domain-error registry and the pino logger.
  app.useGlobalFilters(app.get(GlobalExceptionFilter));
  return app;
}
