import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import { DatabaseUnavailableError } from '../../src/shared/infrastructure/prisma/database-probe';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { LogCapture } from '../support/logging/capture';
import {
  createTestDatabase,
  postgresMajor,
  useTestDatabase,
} from '../support/postgres';

const MIGRATIONS_DIR = join(__dirname, '../../prisma/migrations');

function committedMigrations(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function withClient<T>(
  url: string,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

describe('Prisma module (integration)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('runs on the PostgreSQL major version of the docker-compose.yml image', async () => {
    const [row] = await prisma.$queryRaw<{ major: number }[]>`
      SELECT current_setting('server_version_num')::int / 10000 AS major`;

    expect(row?.major).toBe(postgresMajor());
  });

  it('gives each test file a clone of the migrated template database', async () => {
    const [row] = await prisma.$queryRaw<{ migrations: string | null }[]>`
      SELECT to_regclass('public._prisma_migrations')::text AS migrations`;
    const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name`;

    // The table exists only because `prisma migrate deploy` ran on the template.
    expect(row?.migrations).toBe('_prisma_migrations');
    expect(applied.map((r) => r.migration_name)).toEqual(committedMigrations());
  });

  it('runs SELECT 1 through PrismaService', async () => {
    await expect(prisma.$queryRaw`SELECT 1 AS one`).resolves.toEqual([
      { one: 1 },
    ]);
  });

  it('isolates test databases from each other and drops them', async () => {
    await prisma.$executeRaw`CREATE TABLE harness_probe (id int)`;
    const other = await createTestDatabase();

    const probe = await withClient(other.url, (client) =>
      client.query<{ probe: string | null }>(
        "SELECT to_regclass('public.harness_probe')::text AS probe",
      ),
    );
    await other.drop();
    const exists = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pg_database WHERE datname = ${other.name}`;

    expect(probe.rows[0]?.probe).toBeNull();
    expect(exists[0]?.count).toBe(0);
  });

  it('VII.3 boots when the startup probe reaches the database', async () => {
    const booted = await createTestApp(db.url);

    await expect(
      booted.get(PrismaService).$queryRaw`SELECT 1 AS one`,
    ).resolves.toEqual([{ one: 1 }]);
    await booted.close();
  });

  // Fail fast must not depend on the network refusing quickly: a database that never answers
  // has to stop the boot within the probe bound too. The bound is shortened to 2 s here.
  const PROBE_MS = 2_000;
  const MARGIN_MS = 5_000;

  // Low-entropy credentials, distinctive enough to scan the logs for.
  const USER = 'tcuser';
  const PASSWORD = 'tcpass';

  async function bootFailure(
    databaseUrl: string,
  ): Promise<{ error: unknown; elapsedMs: number; logs: string }> {
    const capture = new LogCapture();
    const started = Date.now();
    const error: unknown = await createTestApp(databaseUrl, {
      probeTimeoutMs: PROBE_MS,
      logs: capture,
    }).catch((e: unknown) => e);
    return { error, elapsedMs: Date.now() - started, logs: capture.raw };
  }

  /** Neither the error nor any log line may reveal where or as whom we tried to connect. */
  function expectNoConnectionDetails(
    text: string,
    host: string,
    port: string,
  ): void {
    for (const secret of [
      host,
      `${host}:${port}`,
      USER,
      PASSWORD,
      'postgresql://',
    ]) {
      expect(text).not.toContain(secret);
    }
  }

  it('VII.3 refuses to boot when the database is unreachable, naming DATABASE_URL only', async () => {
    // A closed port: refused at once on most hosts, may hang where loopback is mirrored.
    const { error, elapsedMs, logs } = await bootFailure(
      `postgresql://${USER}:${PASSWORD}@127.0.0.1:1/none`,
    );

    expect(error).toBeInstanceOf(DatabaseUnavailableError);
    expect((error as Error).message).toContain('DATABASE_URL');
    expectNoConnectionDetails(
      `${(error as Error).message}\n${logs}`,
      '127.0.0.1',
      '1',
    );
    expect(elapsedMs).toBeLessThan(PROBE_MS + MARGIN_MS);
  }, 30_000);

  it('VII.3 refuses to boot within the probe bound when the database never answers', async () => {
    // 10.255.255.1 is not routable: the connection attempt hangs (black hole).
    const { error, elapsedMs, logs } = await bootFailure(
      `postgresql://${USER}:${PASSWORD}@10.255.255.1:5432/none`,
    );

    expect(error).toBeInstanceOf(DatabaseUnavailableError);
    expect((error as Error).message).toBe(
      'Database unreachable: no answer within 2 s. Check DATABASE_URL and that PostgreSQL is running.',
    );
    expectNoConnectionDetails(
      `${(error as Error).message}\n${logs}`,
      '10.255.255.1',
      '5432',
    );
    expect(elapsedMs).toBeGreaterThanOrEqual(PROBE_MS - 100);
    expect(elapsedMs).toBeLessThan(PROBE_MS + MARGIN_MS);
  }, 30_000);

  it('disconnects from the database when the app closes', async () => {
    const closing = await createTestApp(db.url);
    const disconnect = jest.spyOn(closing.get(PrismaService), '$disconnect');

    await closing.close();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
