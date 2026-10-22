import { NodeSDK } from '@opentelemetry/sdk-node';
import { envFilePaths, ignoreEnvFiles } from './config/env-files';
import { validateTelemetryEnv } from './config/telemetry.env';
import { nodeSdkOptions } from './shared/observability/sdk-options';

function loadEnvFiles(): void {
  if (ignoreEnvFiles(process.env.APP_ENV)) return;
  for (const path of envFilePaths(__dirname)) {
    try {
      process.loadEnvFile(path);
    } catch {
      continue;
    }
  }
}

function startTelemetry(): void {
  loadEnvFiles();
  const env = validateTelemetryEnv(process.env);
  if (env.OTEL_SDK_DISABLED || !env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  try {
    new NodeSDK(nodeSdkOptions(env.OTEL_SERVICE_NAME)).start();
  } catch {
    process.stderr.write(
      '[telemetry] SDK failed to start; running without it\n',
    );
  }
}

startTelemetry();
