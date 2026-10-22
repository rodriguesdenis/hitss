import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { isProbe } from './is-probe';

export function nodeSdkOptions(
  serviceName: string,
): Partial<NodeSDKConfiguration> {
  return {
    serviceName,
    autoDetectResources: false,
    logRecordProcessors: [],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: isProbe,
        },
        '@opentelemetry/instrumentation-pino': { enabled: false },
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  };
}
