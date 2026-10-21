import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

const API_DIR = join(__dirname, '../..');
const COMPOSE_FILE = join(API_DIR, '../../docker-compose.yml');

export interface StartedPostgres {
  databaseUrl: string;
  /** Output of `prisma migrate deploy`, for assertions and debugging. */
  migrateOutput: string;
  stop(): Promise<void>;
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

/** Starts a throwaway PostgreSQL (same image as compose) and applies the migrations. */
export async function startPostgres(): Promise<StartedPostgres> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    postgresImage(),
  ).start();
  const databaseUrl = container.getConnectionUri();
  try {
    const migrateOutput = migrateDeploy(databaseUrl);
    return {
      databaseUrl,
      migrateOutput,
      stop: () => container.stop().then(() => undefined),
    };
  } catch (error) {
    await container.stop();
    throw error;
  }
}
