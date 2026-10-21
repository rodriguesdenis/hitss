/**
 * PostgreSQL for integration and e2e tests (ADR-0014).
 *
 * One container per Jest run: `globalSetup` starts it, applies the migrations once into a
 * template database and publishes its coordinates through environment variables. Each test file
 * then gets its own database cloned from that template (`CREATE DATABASE ... TEMPLATE`), which
 * takes milliseconds and isolates files completely.
 *
 * Usage in a test file:
 *
 *   const db = useTestDatabase();               // at describe level
 *   beforeAll(async () => { app = await createTestApp(db.url); });
 *   afterAll(async () => { await app.close(); });
 *
 * or, for an extra database inside a test: `const other = await createTestDatabase()`.
 *
 * Every database created in a file is dropped automatically by a root-level `afterAll`
 * (test/support/after-env.ts, `setupFilesAfterEnv`). Root hooks run after all of the file's own
 * hooks, so apps and clients are closed before the drop terminates their connections. Call
 * `drop()` only to remove a database in the middle of a file.
 *
 * Caveat: the registry is module state. A test that calls `jest.resetModules()` or
 * `jest.isolateModules()` and then creates a database gets a fresh copy of this module, whose
 * registry the root hook never sees, so that database is not dropped. The leak is harmless (the
 * container is discarded at the end of the run), but prefer creating databases outside such
 * blocks.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';
import { getContainerRuntimeClient } from 'testcontainers';

const API_DIR = join(__dirname, '../..');
const COMPOSE_FILE = join(API_DIR, '../../docker-compose.yml');

/** Environment variables through which globalSetup hands the server to the test files. */
const ADMIN_URL_ENV = 'TEST_DATABASE_ADMIN_URL';
const TEMPLATE_ENV = 'TEST_DATABASE_TEMPLATE';
const TEMPLATE_DATABASE = 'app_template';

export interface TestDatabase {
  /** Database name, unique per call. */
  readonly name: string;
  /** Connection URL to pass to `createTestApp()` or a Prisma/pg client. */
  readonly url: string;
  /** Drops the database, terminating any connection still open. */
  drop(): Promise<void>;
}

export interface StartedTestServer {
  container: StartedPostgreSqlContainer;
  /** Output of `prisma migrate deploy` on the template database. */
  migrateOutput: string;
}

/** The PostgreSQL image of docker-compose.yml, so tests and the local stack never drift apart. */
export function postgresImage(composeFile = COMPOSE_FILE): string {
  const match = /^\s*image:\s*(postgres:\S+)\s*$/m.exec(
    readFileSync(composeFile, 'utf8'),
  );
  if (!match?.[1]) {
    throw new Error(`No postgres image found in ${composeFile}`);
  }
  return match[1];
}

/** Major version from the image tag, e.g. `postgres:17.11-alpine` → 17. */
export function postgresMajor(image = postgresImage()): number {
  const major = /^postgres:(\d+)/.exec(image)?.[1];
  if (!major) {
    throw new Error(`No major version in the image tag ${image}`);
  }
  return Number(major);
}

/** Applies the committed migrations exactly as the container entrypoint does. */
export function migrateDeploy(databaseUrl: string): string {
  const prismaCli = require.resolve('prisma/build/index.js', {
    paths: [API_DIR],
  });
  return execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

const quoteIdent = (name: string) => `"${name.replaceAll('"', '""')}"`;

async function query(url: string, ...statements: string[]): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
  } finally {
    await client.end();
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set: run this file through the integration or e2e Jest project ` +
        '(pnpm test:integration / pnpm test:e2e), whose globalSetup starts PostgreSQL.',
    );
  }
  return value;
}

/** Fails with an actionable message when no container runtime is reachable. */
async function assertDockerAvailable(): Promise<void> {
  try {
    await getContainerRuntimeClient();
  } catch (cause) {
    throw new Error(
      'Docker is required for integration and e2e tests (Testcontainers could not reach a ' +
        'container runtime). Start Docker, or run the unit tests only: pnpm test',
      { cause },
    );
  }
}

/**
 * Starts the container, migrates the template database and exports its coordinates.
 * Called once per Jest run by `test/support/global-setup.ts`.
 */
export async function startTestServer(): Promise<StartedTestServer> {
  await assertDockerAvailable();
  const container = await new PostgreSqlContainer(postgresImage()).start();
  try {
    const adminUrl = container.getConnectionUri();
    const template = quoteIdent(TEMPLATE_DATABASE);
    await query(adminUrl, `CREATE DATABASE ${template}`);
    const migrateOutput = migrateDeploy(
      withDatabase(adminUrl, TEMPLATE_DATABASE),
    );
    // Nobody may connect to the template: an open connection would make cloning fail.
    await query(
      adminUrl,
      `ALTER DATABASE ${template} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`,
    );
    process.env[ADMIN_URL_ENV] = adminUrl;
    process.env[TEMPLATE_ENV] = TEMPLATE_DATABASE;
    return { container, migrateOutput };
  } catch (error) {
    await container.stop();
    throw error;
  }
}

/** Databases created by this test file and not dropped yet. */
const created = new Map<string, TestDatabase>();

/** A fresh, migrated database cloned from the template; dropped automatically after the file. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const adminUrl = requireEnv(ADMIN_URL_ENV);
  const template = requireEnv(TEMPLATE_ENV);
  const worker = process.env.JEST_WORKER_ID ?? '0';
  const name = `test_w${worker}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await query(
    adminUrl,
    `CREATE DATABASE ${quoteIdent(name)} TEMPLATE ${quoteIdent(template)}`,
  );
  const database: TestDatabase = {
    name,
    url: withDatabase(adminUrl, name),
    drop: async () => {
      created.delete(name);
      await query(
        adminUrl,
        `DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`,
      );
    },
  };
  created.set(name, database);
  return database;
}

/** Drops every database this file created. Registered once, at root level, by after-env.ts. */
export async function dropTestDatabases(): Promise<void> {
  await Promise.all([...created.values()].map((database) => database.drop()));
}

/**
 * Registers a `beforeAll` that creates a database for the current test file (or describe block).
 * It is dropped after the file (see the module comment). Read `url` inside hooks or tests, not at
 * definition time.
 */
export function useTestDatabase(): {
  readonly url: string;
  readonly name: string;
} {
  let database: TestDatabase | undefined;
  beforeAll(async () => {
    database = await createTestDatabase();
  });
  const current = (): TestDatabase => {
    if (!database) {
      throw new Error('The test database exists only inside hooks and tests');
    }
    return database;
  };
  return {
    get url() {
      return current().url;
    },
    get name() {
      return current().name;
    },
  };
}
