import { Reflector } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import type { AppConfig } from '../../../../../config/app-config';
import {
  IpThrottlerGuard,
  clientAddressOrRefuse,
} from '../../../presentation/ip-throttler.guard';
import {
  IP_THROTTLER,
  USER_THROTTLER,
} from '../../../presentation/named-throttler.guard';
import { OwnerThrottlerGuard } from '../../../presentation/owner-throttler.guard';

const options = {
  throttlers: [
    { name: IP_THROTTLER, ttl: 60_000, limit: 3 },
    { name: USER_THROTTLER, ttl: 60_000, limit: 2 },
  ],
};
const storage = { increment: jest.fn() };
const config = (trusted: string[] = []) =>
  ({ trustedProxies: trusted }) as unknown as AppConfig;

const request = (over: Record<string, unknown> = {}) =>
  ({
    headers: {},
    socket: { remoteAddress: '198.51.100.20' },
    ...over,
  }) as never;

interface Tracked {
  getTracker(request: unknown): Promise<string>;
  setResponseHeader(
    response: Record<string, unknown>,
    name: string,
    value: number,
  ): void;
  throttlers: { name: string }[];
  onModuleInit(): Promise<void>;
}

const ip = (trusted: string[] = []) =>
  new IpThrottlerGuard(
    options,
    storage,
    new Reflector(),
    config(trusted),
  ) as unknown as Tracked;
const owner = () =>
  new OwnerThrottlerGuard(
    options,
    storage,
    new Reflector(),
    config(),
  ) as unknown as Tracked;

describe('clientAddressOrRefuse', () => {
  it('AC-01.7.9 uses the resolved client address', () => {
    expect(clientAddressOrRefuse(request(), false)).toBe('198.51.100.20');
  });

  it('AC-01.7.9 refuses a request with no known address instead of giving it a bucket', () => {
    expect(() =>
      clientAddressOrRefuse(
        request({ socket: { remoteAddress: undefined } }),
        false,
      ),
    ).toThrow(ThrottlerException);
  });

  it('AC-01.7.6 ignores X-Forwarded-For and x-tt-client-ip sent by the client', () => {
    const spoofed = request({
      headers: {
        'x-forwarded-for': '203.0.113.9',
        'x-tt-client-ip': '203.0.113.8',
      },
    });
    expect(clientAddressOrRefuse(spoofed, false)).toBe('198.51.100.20');
  });
});

describe('throttler guards', () => {
  it('AC-01.7.9 the per-address guard applies only the ip throttler', async () => {
    const guard = ip();
    await guard.onModuleInit();
    expect(guard.throttlers.map((t) => t.name)).toEqual([IP_THROTTLER]);
  });

  it('AC-01.7.3 the per-user guard applies only the user throttler', async () => {
    const guard = owner();
    await guard.onModuleInit();
    expect(guard.throttlers.map((t) => t.name)).toEqual([USER_THROTTLER]);
  });

  it('AC-01.7.4 the per-user tracker is the user, so two users from one address do not share a bucket', async () => {
    const marina = await owner().getTracker(
      request({ session: { user: { id: 'u-1' } } }),
    );
    const rafael = await owner().getTracker(
      request({ session: { user: { id: 'u-2' } } }),
    );
    expect(marina).not.toBe(rafael);
  });

  it('AC-01.7.9 a request with no user falls back to the client address', async () => {
    expect(await owner().getTracker(request())).toBe('198.51.100.20');
  });

  it('AC-01.7.3 answers a plain Retry-After and no other rate limit headers', () => {
    const headers: Record<string, unknown> = {};
    const response = {
      setHeader: (n: string, v: unknown) => (headers[n] = v),
      header: (n: string, v: unknown) => (headers[n] = v),
    };
    const guard = ip();
    guard.setResponseHeader(response, 'Retry-After-ip', 12);
    guard.setResponseHeader(response, 'X-RateLimit-Limit-ip', 300);
    expect(Object.keys(headers)).toEqual(['Retry-After']);
  });
});
