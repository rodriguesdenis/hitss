import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { telemetryLifecycle } from './telemetry-lifecycle';

/**
 * Flushes telemetry (5 s cap) after Nest closed the HTTP server and ran the other destroy hooks.
 * Nest's shutdown hooks (`app.enableShutdownHooks()`) own SIGTERM/SIGINT; this class installs no
 * handler for the signal that starts the shutdown.
 */
@Injectable()
export class TelemetryShutdown implements OnApplicationShutdown {
  async onApplicationShutdown(signal?: string): Promise<void> {
    await telemetryLifecycle.shutdown();
    // Relies on a Nest internal: after the hooks, NestApplicationContext.listenToShutdownSignals
    // removes its listeners and calls process.kill(process.pid, signal), which would end the
    // process by signal (not code 0, AC-06.5.4). This turns that re-raise into a clean exit; the
    // e2e test in test/telemetry fails if a Nest upgrade changes the behaviour.
    if (signal === 'SIGTERM' || signal === 'SIGINT') {
      process.once(signal, () => process.exit(0));
    }
  }
}
