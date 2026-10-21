import { INestApplication } from '@nestjs/common';

/** App-level configuration shared by `main.ts` and the e2e/integration test app. */
export function setupApp<T extends INestApplication>(app: T): T {
  // SIGTERM/SIGINT run onModuleDestroy hooks, e.g. closing the Prisma pool (docker stop).
  app.enableShutdownHooks();
  return app;
}
