import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/app.setup';
import { APP_CONFIG, toAppConfig } from '../../src/config/app-config';
import { validate } from '../../src/config/env.validation';

/**
 * Builds the full Nest app against the given database, configured like `main.ts`.
 * AppConfigModule validates the environment when AppModule is imported, so the container URL
 * (known only at runtime) replaces `databaseUrl` in the validated config.
 */
export async function createTestApp(
  databaseUrl: string,
): Promise<INestApplication> {
  const config = { ...toAppConfig(validate({ ...process.env })), databaseUrl };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .compile();

  const app = setupApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}
