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
  betterAuthUrl: string;
  corsOrigins: string[];
  appScheme: string;
  trustedProxies: string[];
  authRateLimitEnabled: boolean;
  rateLimitIpMax: number;
  seedDemo: boolean;
  /** Always false when APP_ENV=production (AC-01.8.6). */
  docsEnabled: boolean;
  otel: {
    sdkDisabled: boolean;
    serviceName: string;
    /** Absent: nothing is exported. */
    exporterEndpoint?: string;
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
    betterAuthUrl: env.BETTER_AUTH_URL,
    corsOrigins: [...env.CORS_ORIGINS],
    appScheme: env.APP_SCHEME,
    trustedProxies: [...env.TRUSTED_PROXIES],
    authRateLimitEnabled: env.AUTH_RATE_LIMIT_ENABLED,
    rateLimitIpMax: env.RATE_LIMIT_IP_MAX,
    seedDemo: env.SEED_DEMO,
    docsEnabled: env.APP_ENV !== 'production' && env.DOCS_ENABLED,
    otel: {
      sdkDisabled: env.OTEL_SDK_DISABLED,
      serviceName: env.OTEL_SERVICE_NAME,
      exporterEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    },
  };
}
