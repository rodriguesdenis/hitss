// Loaded before Nest: `node --import ./dist/instrumentation.js dist/main.js`, so http, express and
// pg are patched before they are first required. Nothing here may import application code.
//
// Telemetry is optional (AC-08.7): traces are exported over OTLP only when
// OTEL_EXPORTER_OTLP_ENDPOINT is set. Without it nothing starts and nothing leaves the process;
// logs (pino JSON with reqId and traceId) are unaffected.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { envFilePaths, ignoreEnvFiles } from './config/env-files';
import { validateTelemetryEnv } from './config/telemetry.env';
import { nodeSdkOptions } from './shared/observability/sdk-options';

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
    new NodeSDK(nodeSdkOptions(env.OTEL_SERVICE_NAME)).start();
  } catch {
    // Telemetry never stops the API from starting.
    process.stderr.write(
      '[telemetry] SDK failed to start; running without it\n',
    );
  }
}

startTelemetry();
