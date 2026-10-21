import { AppEnv, EnvironmentVariables, LOG_LEVELS } from './env.schema';

export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  appEnv: AppEnv;
  port: number;
  databaseUrl: string;
  logLevel: (typeof LOG_LEVELS)[number];
  logPretty: boolean;
  rateLimitMax: number;
  seedOnStart: boolean;
  betterAuthSecret: string;
  otel: {
    sdkDisabled: boolean;
    serviceName: string;
    exporterEndpoint: string;
    exporterProtocol: string;
    resourceAttributes: string;
    tracesSampler: string;
  };
}

export function toAppConfig(env: EnvironmentVariables): AppConfig {
  return {
    appEnv: env.APP_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    logLevel: env.LOG_LEVEL,
    logPretty: env.LOG_PRETTY,
    rateLimitMax: env.RATE_LIMIT_MAX,
    seedOnStart: env.SEED_ON_START,
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    otel: {
      sdkDisabled: env.OTEL_SDK_DISABLED,
      serviceName: env.OTEL_SERVICE_NAME,
      exporterEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      exporterProtocol: env.OTEL_EXPORTER_OTLP_PROTOCOL,
      resourceAttributes: env.OTEL_RESOURCE_ATTRIBUTES,
      tracesSampler: env.OTEL_TRACES_SAMPLER,
    },
  };
}
