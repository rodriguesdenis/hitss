// Loaded before Nest: `node --import ./dist/instrumentation.js dist/main.js`. It must patch http,
// express and pg before they are first required, so nothing here may import application code.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { diag, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter as OTLPMetricExporterJson } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterProto } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter as OTLPTraceExporterJson } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterProto } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { envFilePaths, ignoreEnvFiles } from './config/env-files';
import { validateTelemetryEnv } from './config/telemetry.env';
import { createDedupDiagLogger } from './shared/observability/telemetry/diag-logger';
import { parseResourceAttributes } from './shared/observability/telemetry/resource-attributes';
import { telemetryLifecycle } from './shared/observability/telemetry/telemetry-lifecycle';

const METRIC_EXPORT_INTERVAL_MS = 15_000;

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

function packageVersion(): string {
  try {
    const raw = readFileSync(join(__dirname, '../package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function startTelemetry(): void {
  loadEnvFiles();
  // An invalid OTEL_* value stops the process here, naming the variable (AC-06.5.5).
  const env = validateTelemetryEnv(process.env);
  if (env.OTEL_SDK_DISABLED) return;

  diag.setLogger(
    createDedupDiagLogger({
      warn: (message) => process.stderr.write(`[telemetry] ${message}\n`),
    }),
    DiagLogLevel.WARN,
  );

  const base = env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/+$/, '');
  const json = env.OTEL_EXPORTER_OTLP_PROTOCOL === 'http/json';
  const TraceExporter = json ? OTLPTraceExporterJson : OTLPTraceExporterProto;
  const MetricExporter = json
    ? OTLPMetricExporterJson
    : OTLPMetricExporterProto;

  const environment = process.env.APP_ENV;
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      ...parseResourceAttributes(env.OTEL_RESOURCE_ATTRIBUTES),
      ...(environment ? { 'deployment.environment.name': environment } : {}),
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: packageVersion(),
    }),
    traceExporter: new TraceExporter({ url: `${base}/v1/traces` }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new MetricExporter({ url: `${base}/v1/metrics` }),
        exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
      }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Orchestrator probes stay out of traces (AC-06.1.5): /api/v1/health/*.
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) =>
            (request.url ?? '').startsWith('/api/v1/health/'),
        },
        // No parameter values in DB spans (AC-06.2.5).
        '@opentelemetry/instrumentation-pg': {
          enhancedDatabaseReporting: false,
        },
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
      new PrismaInstrumentation(),
    ],
  });

  try {
    sdk.start();
  } catch {
    // Telemetry must never stop the API from starting (AC-06.5.1).
    process.stderr.write(
      '[telemetry] SDK failed to start; running without it\n',
    );
    return;
  }
  telemetryLifecycle.onShutdown(() => sdk.shutdown());
}

startTelemetry();
