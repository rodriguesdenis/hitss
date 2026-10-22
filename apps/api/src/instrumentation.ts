// Loaded before Nest: `node --import ./dist/instrumentation.js dist/main.js`, so http, express and
// pg are patched before they are first required. Nothing here may import application code.
//
// Telemetry is optional (AC-08.7): traces are exported over OTLP only when
// OTEL_EXPORTER_OTLP_ENDPOINT is set. Without it nothing starts and nothing leaves the process;
// logs (pino JSON with reqId and traceId) are unaffected.
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { envFilePaths, ignoreEnvFiles } from './config/env-files';
import { validateTelemetryEnv } from './config/telemetry.env';
import { isProbe } from './shared/observability/is-probe';

/** Same .env files and precedence as the config module (real environment variables win). */
function loadEnvFiles(): void {
  if (ignoreEnvFiles(process.env.APP_ENV)) return;
  for (const path of envFilePaths(__dirname)) {
    try {
      process.loadEnvFile(path);
    } catch {
      // A missing .env is normal; real environment variables are enough.
    }
  }
}

function startTelemetry(): void {
  loadEnvFiles();
  // An invalid OTEL_* value stops the process here, naming the variable.
  const env = validateTelemetryEnv(process.env);
  if (env.OTEL_SDK_DISABLED || !env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  try {
    // The SDK reads OTEL_EXPORTER_OTLP_ENDPOINT itself and exports traces over OTLP/HTTP.
    new NodeSDK({
      serviceName: env.OTEL_SERVICE_NAME,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Probes stay out of traces.
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingRequestHook: isProbe,
          },
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
        }),
      ],
    }).start();
  } catch {
    // Telemetry never stops the API from starting.
    process.stderr.write(
      '[telemetry] SDK failed to start; running without it\n',
    );
  }
}

startTelemetry();
