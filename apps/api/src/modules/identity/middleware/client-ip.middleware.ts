import type { IncomingMessage, ServerResponse } from 'node:http';

/** Express's request: `ip` is resolved through `trust proxy`. */
export type ClientRequest = IncomingMessage & { ip?: string };

/** The only header Better Auth reads the client address from (`ipAddressHeaders`). */
export const CLIENT_IP_HEADER = 'x-tt-client-ip';

/** `::ffff:203.0.113.7` → `203.0.113.7`, so IPv4 clients have one form on dual-stack sockets. */
function unmapIpv4(address: string): string {
  return /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(address)
    ? address.slice(7)
    : address;
}

/**
 * The client address the API trusts (S-H1): the TCP peer, or, only when TRUSTED_PROXIES is set,
 * Express's `req.ip`, which walks `X-Forwarded-For` back through the trusted proxy CIDRs
 * (`trust proxy`, set by setupApp). Headers the client controls are never read directly.
 */
export function resolveClientIp(
  request: ClientRequest,
  trustProxies: boolean,
): string | undefined {
  const address = trustProxies ? request.ip : request.socket.remoteAddress;
  return address ? unmapIpv4(address) : undefined;
}

/**
 * Runs before the Better Auth handler: drops any client-sent `x-tt-client-ip` and writes the
 * resolved address there, so Better Auth's limiter buckets by the real client and a spoofed
 * header (or `X-Forwarded-For`) cannot pick a fresh bucket (AC-01.7.6).
 */
export function clientIpMiddleware(trustProxies: boolean) {
  return (
    request: ClientRequest,
    _response: ServerResponse,
    next: () => void,
  ): void => {
    delete request.headers[CLIENT_IP_HEADER];
    const address = resolveClientIp(request, trustProxies);
    if (address) {
      request.headers[CLIENT_IP_HEADER] = address;
    }
    next();
  };
}
