import { Injectable, OnApplicationShutdown } from '@nestjs/common';

/**
 * Exit code 0 on SIGTERM/SIGINT (`docker stop`). After every shutdown hook has run, Nest
 * re-raises the signal to end the process, which would exit by signal (143), not 0. This provider
 * lives in the root module, whose hooks run last, and turns that final re-raise into a clean exit.
 * It relies on a Nest internal (NestApplicationContext.listenToShutdownSignals → process.kill);
 * the compose smoke fails if an upgrade changes it.
 */
@Injectable()
export class GracefulExit implements OnApplicationShutdown {
  onApplicationShutdown(signal?: string): void {
    if (signal === 'SIGTERM' || signal === 'SIGINT') {
      process.once(signal, () => process.exit(0));
    }
  }
}
