import type { ServerResponse } from 'node:http';
import {
  CLIENT_IP_HEADER,
  ClientRequest,
  clientIpMiddleware,
} from '../../../middleware/client-ip.middleware';

const request = (
  remoteAddress: string | undefined,
  headers: Record<string, string> = {},
  ip?: string,
) =>
  ({
    headers: { ...headers },
    socket: { remoteAddress },
    ip,
  }) as unknown as ClientRequest;

const run = (trustProxies: boolean, req: ClientRequest) => {
  const next = jest.fn();
  clientIpMiddleware(trustProxies)(req, {} as ServerResponse, next);
  expect(next).toHaveBeenCalledTimes(1);
  return req.headers[CLIENT_IP_HEADER];
};

describe('clientIpMiddleware', () => {
  it('AC-01.7.6 sets the header from the socket address and drops a client-sent one', () => {
    const req = request('198.51.100.20', {
      [CLIENT_IP_HEADER]: '203.0.113.99',
      'x-forwarded-for': '203.0.113.98',
    });

    expect(run(false, req)).toBe('198.51.100.20');
  });

  it('AC-01.7.6 ignores req.ip (X-Forwarded-For) when no proxy is trusted', () => {
    expect(run(false, request('198.51.100.20', {}, '203.0.113.98'))).toBe(
      '198.51.100.20',
    );
  });

  it('AC-01.7.11 uses req.ip (resolved through the trusted proxy CIDRs) when TRUSTED_PROXIES is set', () => {
    expect(run(true, request('10.0.0.5', {}, '203.0.113.7'))).toBe(
      '203.0.113.7',
    );
  });

  it.each([
    ['::ffff:127.0.0.2', '127.0.0.2'],
    ['::FFFF:203.0.113.7', '203.0.113.7'],
    ['2001:db8::1', '2001:db8::1'],
    ['::1', '::1'],
  ])('normalizes %s to %s', (socket, expected) => {
    expect(run(false, request(socket))).toBe(expected);
  });

  it('leaves the header unset when no address is known (never a client value)', () => {
    expect(
      run(false, request(undefined, { [CLIENT_IP_HEADER]: '203.0.113.99' })),
    ).toBeUndefined();
  });
});
