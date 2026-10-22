import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import type { ClientRequest } from '../middleware/client-ip.middleware';
import { clientAddressOrRefuse } from './ip-throttler.guard';
import { NamedThrottlerGuard, USER_THROTTLER } from './named-throttler.guard';

type SessionRequest = ClientRequest & {
  session?: { user?: { id?: unknown } } | null;
};

@Injectable()
export class OwnerThrottlerGuard extends NamedThrottlerGuard {
  protected readonly throttlerName = USER_THROTTLER;
  private readonly trustProxies: boolean;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    super(options, storage, reflector);
    this.trustProxies = config.trustedProxies.length > 0;
  }

  protected override getTracker(
    request: Record<string, unknown>,
  ): Promise<string> {
    const typed = request as unknown as SessionRequest;
    const id = typed.session?.user?.id;
    return Promise.resolve(
      typeof id === 'string'
        ? `user:${id}`
        : clientAddressOrRefuse(typed, this.trustProxies),
    );
  }
}
