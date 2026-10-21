import { INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

/** App-level configuration shared by `main.ts` and the e2e/integration test app. */
export function setupApp<T extends INestApplication>(app: T): T {
  // Nest's own logs (and PrismaService's) go through pino: JSON, redacted, trace-correlated.
  app.useLogger(app.get(Logger));
  // SIGTERM/SIGINT run onModuleDestroy hooks, e.g. closing the Prisma pool (docker stop).
  app.enableShutdownHooks();
  return app;
}
