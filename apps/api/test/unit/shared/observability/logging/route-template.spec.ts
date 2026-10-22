import type { IncomingMessage } from 'node:http';
import {
  routeOf,
  trackRouteTemplate,
} from '../../../../../src/shared/observability/logging/route-template';

type Routed = IncomingMessage & { route?: { path: string }; baseUrl?: string };

function track(): Routed {
  const request = { baseUrl: '/api' } as Routed;
  trackRouteTemplate(request);
  return request;
}

describe('route template', () => {
  it('AC-06.3.1 keeps the matched template when a catch-all route is entered later', () => {
    const request = track();
    request.route = { path: '/v1/tasks/:id' };
    request.route = { path: '{/*splat}' };

    expect(routeOf(request, '/api/v1/tasks/7?q=1')).toBe('/api/v1/tasks/:id');
  });

  it('AC-06.3.7 falls back to the URL without its query when no route matched', () => {
    const request = track();
    request.route = { path: '{/*splat}' };

    expect(routeOf(request, '/api/auth/x?token=abc')).toBe('/api/auth/x');
  });
});
