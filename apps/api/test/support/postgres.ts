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

const ADMIN_URL_ENV = 'TEST_DATABASE_ADMIN_URL';
const TEMPLATE_ENV = 'TEST_DATABASE_TEMPLATE';
const TEMPLATE_DATABASE = 'app_template';

export interface TestDatabase {
  readonly name: string;
  readonly url: string;
  drop(): Promise<void>;
}

export interface StartedTestServer {
  container: StartedPostgreSqlContainer;
  migrateOutput: string;
}

export function postgresImage(composeFile = COMPOSE_FILE): string {
  const match = /^\s*image:\s*(postgres:\S+)\s*$/m.exec(
    readFileSync(composeFile, 'utf8'),
  );
  if (!match?.[1]) {
    throw new Error(`No postgres image found in ${composeFile}`);
  }
  return match[1];
}

export function postgresMajor(image = postgresImage()): number {
  const major = /^postgres:(\d+)/.exec(image)?.[1];
  if (!major) {
    throw new Error(`No major version in the image tag ${image}`);
  }
  return Number(major);
}

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

const created = new Map<string, TestDatabase>();

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

export async function dropTestDatabases(): Promise<void> {
  await Promise.all([...created.values()].map((database) => database.drop()));
}

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
