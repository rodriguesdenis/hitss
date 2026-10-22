import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/app.setup';
import {
  APP_CONFIG,
  AppConfig,
  toAppConfig,
} from '../../src/config/app-config';
import { validate } from '../../src/config/env.validation';
import { DATABASE_PROBE_TIMEOUT } from '../../src/shared/infrastructure/prisma/database-probe';
import { createLoggerParams } from '../../src/shared/observability/logging/logger.config';
import { LogCapture } from './logging/capture';

export interface TestAppOptions {
  imports?: Type[];
  logs?: LogCapture;
  config?: Partial<AppConfig>;
  providers?: { provide: unknown; useValue: unknown }[];
  probeTimeoutMs?: number;
}

export async function createTestApp(
  databaseUrl: string,
  options: TestAppOptions = {},
): Promise<INestApplication> {
  const config: AppConfig = {
    ...toAppConfig(validate({ ...process.env })),
    rateLimitMax: 100_000,
    rateLimitIpMax: 100_000,
    ...options.config,
    databaseUrl,
  };
  let builder = Test.createTestingModule({
    imports: [AppModule, ...(options.imports ?? [])],
  })
    .overrideProvider(APP_CONFIG)
    .useValue(config);
  for (const { provide, useValue } of options.providers ?? []) {
    builder = builder.overrideProvider(provide).useValue(useValue);
  }
  if (options.logs) {
    builder = builder
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue(
        createLoggerParams(
          { level: config.logLevel, pretty: false },
          options.logs,
        ),
      );
  }
  if (options.probeTimeoutMs !== undefined) {
    builder = builder
      .overrideProvider(DATABASE_PROBE_TIMEOUT)
      .useValue(options.probeTimeoutMs);
  }
  const moduleRef = await builder.compile();

  const app = setupApp(
    moduleRef.createNestApplication({ bodyParser: false, bufferLogs: true }),
  );
  await app.init();
  return app;
}
