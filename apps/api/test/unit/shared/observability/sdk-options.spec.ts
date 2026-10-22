import { nodeSdkOptions } from '../../../../src/shared/observability/sdk-options';

describe('nodeSdkOptions', () => {
  const options = nodeSdkOptions('teams-tasks-api');

  it('AC-08.7 names the service and detects no other resource (no process args or host ids)', () => {
    expect(options.serviceName).toBe('teams-tasks-api');
    expect(options.autoDetectResources).toBe(false);
  });

  it('AC-08.7 has no log record processors: logs stay on stdout', () => {
    expect(options.logRecordProcessors).toEqual([]);
  });

  it('AC-08.7 turns the pino instrumentation off: no duplicate trace_id/span_id and no log sending', () => {
    const pino = (options.instrumentations ?? [])
      .flat()
      .find(
        (i) => i.instrumentationName === '@opentelemetry/instrumentation-pino',
      );
    // A disabled instrumentation is left out of the list altogether.
    expect(pino).toBeUndefined();
    expect((options.instrumentations ?? []).flat().length).toBeGreaterThan(0);
  });

  it('AC-08.7 keeps the http instrumentation, which ignores health probes', () => {
    const http = (options.instrumentations ?? [])
      .flat()
      .find(
        (i) => i.instrumentationName === '@opentelemetry/instrumentation-http',
      );
    expect(http).toBeDefined();
    const ignore = (
      http?.getConfig() as {
        ignoreIncomingRequestHook?: (r: { url?: string }) => boolean;
      }
    ).ignoreIncomingRequestHook;
    expect(ignore?.({ url: '/api/v1/health/ready' })).toBe(true);
    expect(ignore?.({ url: '/api/v1/teams' })).toBe(false);
  });
});
