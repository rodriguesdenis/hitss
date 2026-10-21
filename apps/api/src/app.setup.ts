import { INestApplication, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { requestIdMiddleware } from './shared/observability/logging/request-id';
import { GlobalExceptionFilter } from './shared/presentation/filters/global-exception.filter';
import { EnvelopeInterceptor } from './shared/presentation/interceptors/envelope.interceptor';
import { AppValidationPipe } from './shared/presentation/pipes/validation.pipe';

/**
 * App-level configuration shared by `main.ts` and the e2e/integration test app, so both serve
 * the same HTTP conventions (ADR-0005). Order matters:
 * 1. pino logger, so every later log line (filter, Prisma, Nest) is JSON, redacted, correlated;
 * 2. shutdown hooks;
 * 3. request id, registered before the body parser so even 413/400 parse errors carry it;
 * 4. `/api` prefix and URI versioning v1;
 * 5. validation pipe, `{ data }` envelope interceptor, `{ error }` exception filter.
 */
export function setupApp<T extends INestApplication>(app: T): T {
  app.useLogger(app.get(Logger));
  // SIGTERM/SIGINT run onModuleDestroy hooks, e.g. closing the Prisma pool (docker stop).
  app.enableShutdownHooks();
  app.use(requestIdMiddleware);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalInterceptors(new EnvelopeInterceptor(app.get(Reflector)));
  // From the container: built with the domain-error registry and the pino logger.
  app.useGlobalFilters(app.get(GlobalExceptionFilter));
  return app;
}
