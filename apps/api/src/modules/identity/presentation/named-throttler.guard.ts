import { ThrottlerGuard } from '@nestjs/throttler';

/** Names of the two throttlers configured by ThrottlingConfig (T-001-15). */
export const IP_THROTTLER = 'ip';
export const USER_THROTTLER = 'user';

/**
 * A ThrottlerGuard that applies exactly one of the configured throttlers, so the per-address one
 * can run before authentication and the per-user one after it, as two global guards in order.
 * It answers a plain `Retry-After` (seconds) and no `X-RateLimit-*` headers, whatever the
 * throttler's name.
 */
export abstract class NamedThrottlerGuard extends ThrottlerGuard {
  protected abstract readonly throttlerName: string;

  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter(
      (throttler) => throttler.name === this.throttlerName,
    );
  }

  protected override setResponseHeader(
    response: Record<string, unknown>,
    name: string,
    value: string | number,
  ): void {
    if (name.startsWith('Retry-After')) {
      super.setResponseHeader(response, 'Retry-After', value);
    }
  }
}
