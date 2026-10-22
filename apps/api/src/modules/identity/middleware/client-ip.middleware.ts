import type { IncomingMessage, ServerResponse } from 'node:http';

export type ClientRequest = IncomingMessage & { ip?: string };

export const CLIENT_IP_HEADER = 'x-tt-client-ip';

function unmapIpv4(address: string): string {
  return /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(address)
    ? address.slice(7)
    : address;
}

export function resolveClientIp(
  request: ClientRequest,
  trustProxies: boolean,
): string | undefined {
  const address = trustProxies ? request.ip : request.socket.remoteAddress;
  return address ? unmapIpv4(address) : undefined;
}

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
