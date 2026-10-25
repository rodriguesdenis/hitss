import { INestApplication, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { APP_CONFIG, AppConfig } from './config/app-config';
import { setupDocs } from './openapi/openapi-document';
import { requestIdMiddleware } from './shared/observability/logging/request-id';
import { corsOptions } from './shared/presentation/cors-options';
import { GlobalExceptionFilter } from './shared/presentation/filters/global-exception.filter';
import { EnvelopeInterceptor } from './shared/presentation/interceptors/envelope.interceptor';
import { AppValidationPipe } from './shared/presentation/pipes/validation.pipe';

export function configureRouting(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}

export function setupApp<T extends INestApplication>(app: T): T {
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  const config = app.get<AppConfig>(APP_CONFIG);
  const express = app.getHttpAdapter().getInstance() as {
    set(setting: string, value: unknown): void;
  };
  express.set('etag', false);
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
  configureRouting(app);
  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalInterceptors(new EnvelopeInterceptor(app.get(Reflector)));
  app.useGlobalFilters(app.get(GlobalExceptionFilter));
  if (config.docsEnabled) {
    setupDocs(app);
  }
  return app;
}
