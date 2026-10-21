import type { INestApplication } from '@nestjs/common';
import { telemetryLifecycle } from './telemetry-lifecycle';

const SIGNALS = ['SIGTERM', 'SIGINT'] as const;

/**
 * On SIGTERM/SIGINT: stop accepting requests and run Nest destroy hooks, then flush telemetry
 * (5 s cap) and exit 0 (AC-06.5.4).
 */
export function registerGracefulShutdown(app: INestApplication): void {
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await app.close();
    } finally {
      await telemetryLifecycle.shutdown();
    }
    process.exit(0);
  };
  for (const signal of SIGNALS) {
    process.on(signal, () => void stop().catch(() => process.exit(1)));
  }
}
