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

/** Applied only when APP_ENV=production. Add one entry per rule; validate() never changes. */
export const productionRules: ProductionRule[] = [
  secretIsNotAPlaceholder,
  databaseIsNotTheLocalOne,
  seedIsOff,
  logLevelIsNotVerbose,
];
