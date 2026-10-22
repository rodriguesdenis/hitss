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
  /** Test-only modules mounted next to AppModule (e.g. probe controllers). */
  imports?: Type[];
  /** Receives every pino log line of the app as JSON (e.g. for leak scans). */
  logs?: LogCapture;
  /** Overrides of the validated config (e.g. CORS origins for one test file). */
  config?: Partial<AppConfig>;
  /** Provider overrides (e.g. spies around the password hasher). */
  providers?: { provide: unknown; useValue: unknown }[];
  /** Bound of the startup database probe, shorter than the 10 s default (fail-fast tests). */
  probeTimeoutMs?: number;
}

/**
 * Builds the full Nest app against the given database, configured like `main.ts`.
 * AppConfigModule validates the environment when AppModule is imported, so the container URL
 * (known only at runtime) replaces `databaseUrl` in the validated config.
 */
export async function createTestApp(
  databaseUrl: string,
  options: TestAppOptions = {},
): Promise<INestApplication> {
  const config: AppConfig = {
    ...toAppConfig(validate({ ...process.env })),
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
