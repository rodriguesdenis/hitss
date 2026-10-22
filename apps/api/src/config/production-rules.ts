import { parseProxy, parseUrl } from './auth.env';
import type { Violation } from './config-validation-error';
import type { EnvironmentVariables } from './env.schema';

export type { Violation };

export type ProductionRule = (config: EnvironmentVariables) => Violation[];

export const PLACEHOLDER_SECRET_PREFIXES = ['local-dev-', 'unit-test-secret-'];

export const LOCAL_DATABASE_PASSWORD = 'teams-local-only';

export const secretIsNotAPlaceholder: ProductionRule = (config) =>
  PLACEHOLDER_SECRET_PREFIXES.some((prefix) =>
    config.BETTER_AUTH_SECRET.startsWith(prefix),
  )
    ? [
        {
          variable: 'BETTER_AUTH_SECRET',
          message: 'must not be a placeholder from .env.example or the tests',
        },
      ]
    : [];

export const databaseIsNotTheLocalOne: ProductionRule = (config) =>
  config.DATABASE_URL.includes(LOCAL_DATABASE_PASSWORD)
    ? [
        {
          variable: 'DATABASE_URL',
          message: 'must not use the local placeholder password',
        },
      ]
    : [];

export const seedIsOff: ProductionRule = (config) =>
  config.SEED_ON_START
    ? [{ variable: 'SEED_ON_START', message: 'must be false in production' }]
    : [];

export const VERBOSE_LOG_LEVELS = ['debug', 'trace'];

export const logLevelIsNotVerbose: ProductionRule = (config) =>
  VERBOSE_LOG_LEVELS.includes(config.LOG_LEVEL)
    ? [
        {
          variable: 'LOG_LEVEL',
          message: `must not be ${VERBOSE_LOG_LEVELS.join(' or ')} in production`,
        },
      ]
    : [];

export const logPrettyIsOff: ProductionRule = (config) =>
  config.LOG_PRETTY
    ? [{ variable: 'LOG_PRETTY', message: 'must be false in production' }]
    : [];

export const otlpEndpointIsSecure: ProductionRule = (config) => {
  const endpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (config.OTEL_SDK_DISABLED || !endpoint) return [];
  return URL.canParse(endpoint) && new URL(endpoint).protocol === 'https:'
    ? []
    : [
        {
          variable: 'OTEL_EXPORTER_OTLP_ENDPOINT',
          message: 'must use https in production',
        },
      ];
};

const PER_SIGNAL_ENDPOINTS = [
  'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
  'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
  'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
] as const;

export const otlpPerSignalEndpointsAreUnset: ProductionRule = (config) =>
  PER_SIGNAL_ENDPOINTS.filter((name) => config[name]).map((variable) => ({
    variable,
    message: 'is not supported in production; use OTEL_EXPORTER_OTLP_ENDPOINT',
  }));

export const authUrlIsHttps: ProductionRule = (config) =>
  parseUrl(config.BETTER_AUTH_URL)?.protocol === 'https:'
    ? []
    : [{ variable: 'BETTER_AUTH_URL', message: 'must be https in production' }];

const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname.startsWith('127.') ||
  ['0.0.0.0', '[::1]', '[::]', '[::ffff:7f00:1]'].includes(hostname);

const hasLoopbackHost = (value: string): boolean => {
  const url = parseUrl(value);
  return url === null || isLoopbackHost(url.hostname);
};

const isUnsafeOrigin = (origin: string): boolean =>
  origin === '*' || origin.startsWith('http://') || hasLoopbackHost(origin);

export const authUrlIsNotLoopback: ProductionRule = (config) =>
  hasLoopbackHost(config.BETTER_AUTH_URL)
    ? [
        {
          variable: 'BETTER_AUTH_URL',
          message: 'must not be localhost or a loopback address in production',
        },
      ]
    : [];

export const corsOriginsAreSafe: ProductionRule = (config) =>
  config.CORS_ORIGINS.some(isUnsafeOrigin)
    ? [
        {
          variable: 'CORS_ORIGINS',
          message:
            'must not contain *, http:// origins or localhost in production',
        },
      ]
    : [];

export const authRateLimitIsOn: ProductionRule = (config) =>
  config.AUTH_RATE_LIMIT_ENABLED
    ? []
    : [
        {
          variable: 'AUTH_RATE_LIMIT_ENABLED',
          message: 'must be true in production',
        },
      ];

export const MIN_PROXY_PREFIX = { 4: 8, 6: 16 } as const;

export const trustedProxiesAreNarrow: ProductionRule = (config) =>
  config.TRUSTED_PROXIES.some((item) => {
    const range = parseProxy(item);
    return range === null || range.prefix < MIN_PROXY_PREFIX[range.family];
  })
    ? [
        {
          variable: 'TRUSTED_PROXIES',
          message: `must not contain IPv4 ranges wider than /${MIN_PROXY_PREFIX[4]} or IPv6 ranges wider than /${MIN_PROXY_PREFIX[6]} in production`,
        },
      ]
    : [];

export const demoSeedIsOff: ProductionRule = (config) =>
  config.SEED_DEMO
    ? [{ variable: 'SEED_DEMO', message: 'must be false in production' }]
    : [];

export const productionRules: ProductionRule[] = [
  secretIsNotAPlaceholder,
  databaseIsNotTheLocalOne,
  seedIsOff,
  logLevelIsNotVerbose,
  logPrettyIsOff,
  otlpEndpointIsSecure,
  otlpPerSignalEndpointsAreUnset,
  authUrlIsHttps,
  authUrlIsNotLoopback,
  corsOriginsAreSafe,
  authRateLimitIsOn,
  trustedProxiesAreNarrow,
  demoSeedIsOff,
];
