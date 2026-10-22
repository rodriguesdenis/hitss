import type { IncomingMessage } from 'node:http';
import { sanitizeUrl } from '../sanitize-url';

type RoutedRequest = IncomingMessage & {
  baseUrl?: string;
  route?: { path?: unknown };
};

const templates = new WeakMap<IncomingMessage, string>();

export function trackRouteTemplate(request: IncomingMessage): void {
  const routed = request as RoutedRequest;
  let current = routed.route;
  Object.defineProperty(routed, 'route', {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (route: RoutedRequest['route']) => {
      current = route;
      const path = route?.path;
      if (typeof path === 'string' && !path.includes('*')) {
        templates.set(request, `${routed.baseUrl ?? ''}${path}`);
      }
    },
  });
}

export function routeOf(request: IncomingMessage, url: string): string {
  return templates.get(request) ?? sanitizeUrl(url);
}
