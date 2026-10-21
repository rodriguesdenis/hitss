import { INestApplication, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { setupApp } from './app.setup';
import { APP_CONFIG } from './config/app-config';
import { corsOptions } from './shared/presentation/cors-options';
import { requestIdMiddleware } from './shared/observability/logging/request-id';
import { GlobalExceptionFilter } from './shared/presentation/filters/global-exception.filter';
import { EnvelopeInterceptor } from './shared/presentation/interceptors/envelope.interceptor';
import { AppValidationPipe } from './shared/presentation/pipes/validation.pipe';

describe('setupApp', () => {
  const logger = {};
  const filter = new GlobalExceptionFilter();
  const reflector = new Reflector();
  const fromContainer = new Map<unknown, unknown>([
    [Logger, logger],
    [GlobalExceptionFilter, filter],
    [Reflector, reflector],
    [APP_CONFIG, { corsOrigins: ['https://app.example.test'] }],
  ]);
  const calls: string[] = [];
  const track =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(name);
      return args;
    };
  const app = {
    get: jest.fn((token: unknown) => fromContainer.get(token)),
    useLogger: jest.fn(track('useLogger')),
    enableShutdownHooks: jest.fn(track('enableShutdownHooks')),
    use: jest.fn(track('use')),
    enableCors: jest.fn(track('enableCors')),
    setGlobalPrefix: jest.fn(track('setGlobalPrefix')),
    enableVersioning: jest.fn(track('enableVersioning')),
    useGlobalPipes: jest.fn(track('useGlobalPipes')),
    useGlobalInterceptors: jest.fn(track('useGlobalInterceptors')),
    useGlobalFilters: jest.fn(track('useGlobalFilters')),
  };

  beforeAll(() => {
    expect(setupApp(app as unknown as INestApplication)).toBe(app);
  });

  it('AC-06.3.5 routes Nest logs through the pino logger, before anything else', () => {
    expect(app.useLogger).toHaveBeenCalledWith(logger);
    expect(calls[0]).toBe('useLogger');
  });

  it('enables shutdown hooks so SIGTERM closes the app and its database pool', () => {
    expect(app.enableShutdownHooks).toHaveBeenCalledTimes(1);
  });

  it('serves the API under /api/v1 (URI versioning, default version 1)', () => {
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
  });

  it('T-001-04 adds helmet and CORS from CORS_ORIGINS', () => {
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(app.use).toHaveBeenNthCalledWith(2, expect.any(Function));
    expect(app.enableCors).toHaveBeenCalledWith(
      corsOptions(['https://app.example.test']),
    );
  });

  it('registers the request-id middleware and the validation pipe', () => {
    expect(app.use).toHaveBeenNthCalledWith(1, requestIdMiddleware);
    expect(app.useGlobalPipes).toHaveBeenCalledWith(
      expect.any(AppValidationPipe),
    );
  });

  it('uses the container for the error filter (domain-error registry, logger) and the Reflector', () => {
    expect(app.useGlobalFilters).toHaveBeenCalledWith(filter);
    expect(app.useGlobalInterceptors).toHaveBeenCalledWith(
      expect.any(EnvelopeInterceptor),
    );
    expect(app.get).toHaveBeenCalledWith(Reflector);
  });

  it('keeps the documented order', () => {
    expect(calls).toEqual([
      'useLogger',
      'enableShutdownHooks',
      'use',
      'use',
      'enableCors',
      'setGlobalPrefix',
      'enableVersioning',
      'useGlobalPipes',
      'useGlobalInterceptors',
      'useGlobalFilters',
    ]);
  });
});
