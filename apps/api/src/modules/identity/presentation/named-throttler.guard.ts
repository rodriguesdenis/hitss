import { ThrottlerGuard } from '@nestjs/throttler';

export const IP_THROTTLER = 'ip';
export const USER_THROTTLER = 'user';

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
