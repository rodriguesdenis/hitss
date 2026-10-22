// Entry point of the demo seed: `node dist/seed/run.js`. Run by the container entrypoint after the
// migrations when SEED_ON_START=true, and by `pnpm db:seed`. Idempotent; exits 0 when the gate
// skips the demo data, non-zero on any failure. Logs counts and reasons only, never credentials.
import pino from 'pino';
import { loadAppConfig, loadEnvFiles } from '../config/load-config';
import { createAuth } from '../modules/identity/auth.factory';
import { BetterAuthPasswordHasher } from '../modules/identity/password-hasher';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { DEMO_USER_ID } from './fixtures';
import { seedDemo } from './seed-demo';

async function main(): Promise<void> {
  loadEnvFiles();
  const config = loadAppConfig();
  const logger = pino({ level: 'warn' });
  const prisma = new PrismaService(config);
  await prisma.onModuleInit();
  try {
    const result = await seedDemo({
      config,
      prisma,
      auth: () =>
        createAuth(config, prisma, logger, new BetterAuthPasswordHasher(), {
          fixedUserId: DEMO_USER_ID,
        }),
    });
    console.log(
      result.seeded
        ? `seed: demo account ${result.user}, ${result.teams} teams, ${result.tasks} tasks`
        : `seed: demo data skipped (${result.skippedBecause})`,
    );
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((error: unknown) => {
  console.error(
    `seed failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
