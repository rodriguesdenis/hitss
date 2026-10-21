import type { IncomingMessage } from 'node:http';
import { sanitizeUrl } from '../sanitize-url';

type RoutedRequest = IncomingMessage & {
  baseUrl?: string;
  route?: { path?: unknown };
};

const templates = new WeakMap<IncomingMessage, string>();

/**
 * Remembers the Express route template (`/api/v1/tasks/:id`) of a request. Express assigns
 * `req.route` for every route layer it enters and Nest's catch-all middleware route overwrites the
 * handler's, so reading `req.route` at completion would log `{/*splat}`. Wildcard routes are
 * ignored. Call before routing starts (genReqId runs first).
 */
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

/** Route template of the request, else the URL without query string (unmatched paths). */
export function routeOf(request: IncomingMessage, url: string): string {
  return templates.get(request) ?? sanitizeUrl(url);
}
