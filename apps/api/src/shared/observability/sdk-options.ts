import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { isProbe } from './is-probe';

/**
 * NodeSDK settings for the optional OTLP export (AC-08.7). The SDK reads
 * OTEL_EXPORTER_OTLP_ENDPOINT itself and exports traces over OTLP/HTTP.
 */
export function nodeSdkOptions(
  serviceName: string,
): Partial<NodeSDKConfiguration> {
  return {
    serviceName,
    // Only the service name: no process command line, owner or host id in the resource.
    autoDetectResources: false,
    // Logs stay on stdout: no OTLP log pipeline.
    logRecordProcessors: [],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Probes stay out of traces.
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: isProbe,
        },
        // The logger mixin already adds traceId/spanId; this one would add trace_id/span_id as
        // well and ship pino records over OTLP.
        '@opentelemetry/instrumentation-pino': { enabled: false },
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  };
}
