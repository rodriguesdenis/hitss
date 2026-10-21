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
    // Once every hook has run, Nest re-raises the signal to end the process, which would exit
    // by signal (not code 0, AC-06.5.4). Turn that final re-raise into a clean exit.
    if (signal === 'SIGTERM' || signal === 'SIGINT') {
      process.once(signal, () => process.exit(0));
    }
  }
}
