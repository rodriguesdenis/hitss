import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../support/app';
import { StartedPostgres, startPostgres } from '../support/postgres';

describe('App (e2e)', () => {
  let postgres: StartedPostgres;
  let app: INestApplication | undefined;

  beforeAll(async () => {
    postgres = await startPostgres();
  });

  afterAll(async () => {
    await app?.close();
    await postgres?.stop();
  });

  it('boots the full app against a migrated database and shuts down cleanly', async () => {
    app = await createTestApp(postgres.databaseUrl);

    await expect(app.close()).resolves.toBeUndefined();
    app = undefined;
  });
});
