import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerException,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import {
  type ClientRequest,
  resolveClientIp,
} from '../middleware/client-ip.middleware';
import { IP_THROTTLER, NamedThrottlerGuard } from './named-throttler.guard';

export function clientAddressOrRefuse(
  request: ClientRequest,
  trustProxies: boolean,
): string {
  const address = resolveClientIp(request, trustProxies);
  if (!address) throw new ThrottlerException();
  return address;
}

@Injectable()
export class IpThrottlerGuard extends NamedThrottlerGuard {
  protected readonly throttlerName = IP_THROTTLER;
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
    return Promise.resolve(
      clientAddressOrRefuse(
        request as unknown as ClientRequest,
        this.trustProxies,
      ),
    );
  }
}
