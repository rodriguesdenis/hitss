import { Injectable, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class GracefulExit implements OnApplicationShutdown {
  onApplicationShutdown(signal?: string): void {
    if (signal === 'SIGTERM' || signal === 'SIGINT') {
      process.once(signal, () => process.exit(0));
    }
  }
}
