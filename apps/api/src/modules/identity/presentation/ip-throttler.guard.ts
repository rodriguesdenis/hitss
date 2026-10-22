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

/**
 * The client address the throttlers key on: the same resolution as `x-tt-client-ip`
 * (S-H1, AC-01.7.6). Without one the request cannot be attributed, so it is refused, never
 * granted a bucket of its own (fail closed).
 */
export function clientAddressOrRefuse(
  request: ClientRequest,
  trustProxies: boolean,
): string {
  const address = resolveClientIp(request, trustProxies);
  if (!address) throw new ThrottlerException();
  return address;
}

/**
 * Per-address limit on the whole API (`RATE_LIMIT_IP_MAX`), registered before the authentication
 * guard so anonymous and forged-token traffic is bounded before any session lookup (AC-01.7.9).
 */
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
