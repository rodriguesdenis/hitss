/** Orchestrator probes (liveness/readiness): never logged or traced (AC-06.1.5). */
export const PROBE_PATH_PREFIX = '/api/v1/health/';

export function isProbe(request: { url?: string }): boolean {
  return (request.url ?? '').startsWith(PROBE_PATH_PREFIX);
}
