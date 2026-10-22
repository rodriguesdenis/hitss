export const PROBE_PATH_PREFIX = '/api/v1/health/';

export function isProbe(request: { url?: string }): boolean {
  return (request.url ?? '').startsWith(PROBE_PATH_PREFIX);
}
