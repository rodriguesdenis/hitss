import { parseProxy, parseUrl } from './auth.env';
import type { Violation } from './config-validation-error';
import type { EnvironmentVariables } from './env.schema';

export type { Violation };

/** A production rule inspects the already type-valid configuration. Names variables, never values. */
export type ProductionRule = (config: EnvironmentVariables) => Violation[];

/** Prefixes of the placeholder secrets shipped in `.env.example` and the unit-test setup. */
export const PLACEHOLDER_SECRET_PREFIXES = ['local-dev-', 'unit-test-secret-'];

/** Password of the local database from `.env.example` and docker-compose.yml. */
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

/** Levels that log query statements and request details; diagnostics for local use only. */
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

/** Collector inside the compose network, reached over plain HTTP by design. */
export const COMPOSE_COLLECTOR_HOST = 'signoz-otel-collector';

export const otlpEndpointIsSecure: ProductionRule = (config) => {
  if (config.OTEL_SDK_DISABLED) return [];
  const url = URL.canParse(config.OTEL_EXPORTER_OTLP_ENDPOINT)
    ? new URL(config.OTEL_EXPORTER_OTLP_ENDPOINT)
    : undefined;
  return url &&
    (url.protocol === 'https:' || url.hostname === COMPOSE_COLLECTOR_HOST)
    ? []
    : [
        {
          variable: 'OTEL_EXPORTER_OTLP_ENDPOINT',
          message: 'must use https in production',
        },
      ];
};

export const authUrlIsHttps: ProductionRule = (config) =>
  parseUrl(config.BETTER_AUTH_URL)?.protocol === 'https:'
    ? []
    : [{ variable: 'BETTER_AUTH_URL', message: 'must be https in production' }];

/**
 * Hosts that resolve to this machine (`URL.hostname` form): localhost names, 127/8, the IPv6
 * loopback, the unspecified addresses and the IPv4-mapped loopback (WHATWG normalizes
 * `[::ffff:127.0.0.1]` to `[::ffff:7f00:1]`).
 */
const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname.startsWith('127.') ||
  ['0.0.0.0', '[::1]', '[::]', '[::ffff:7f00:1]'].includes(hostname);

/** Validated values always parse; an unparseable one is treated as unsafe, never thrown. */
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

/** Narrowest acceptable prefix per family in production: wider ranges trust too many hosts. */
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

/** Applied only when APP_ENV=production. Add one entry per rule; validate() never changes. */
export const productionRules: ProductionRule[] = [
  secretIsNotAPlaceholder,
  databaseIsNotTheLocalOne,
  seedIsOff,
  logLevelIsNotVerbose,
  logPrettyIsOff,
  otlpEndpointIsSecure,
  authUrlIsHttps,
  authUrlIsNotLoopback,
  corsOriginsAreSafe,
  authRateLimitIsOn,
  trustedProxiesAreNarrow,
  demoSeedIsOff,
];
