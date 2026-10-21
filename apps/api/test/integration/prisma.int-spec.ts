import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { StartedPostgres, startPostgres } from '../support/postgres';

const MIGRATIONS_DIR = join(__dirname, '../../prisma/migrations');

function committedMigrations(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe('Prisma module (integration)', () => {
  let postgres: StartedPostgres;
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    postgres = await startPostgres();
    app = await createTestApp(postgres.databaseUrl);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    await postgres?.stop();
  });

  it('runs on PostgreSQL 17, the major version of docker-compose.yml', async () => {
    const [row] = await prisma.$queryRaw<{ major: number }[]>`
      SELECT current_setting('server_version_num')::int / 10000 AS major`;

    expect(row?.major).toBe(17);
  });

  it('applies every committed migration with prisma migrate deploy', async () => {
    const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name`;

    expect(applied.map((row) => row.migration_name)).toEqual(
      committedMigrations(),
    );
  });

  it('runs SELECT 1 through PrismaService', async () => {
    await expect(prisma.$queryRaw`SELECT 1 AS one`).resolves.toEqual([
      { one: 1 },
    ]);
  });

  it('disconnects from the database when the app closes', async () => {
    const closing = await createTestApp(postgres.databaseUrl);
    const disconnect = jest.spyOn(closing.get(PrismaService), '$disconnect');

    await closing.close();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
