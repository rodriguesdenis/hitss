import type { EnvironmentVariables } from './env.schema';

export interface Violation {
  variable: string;
  message: string;
}

/** A production rule inspects the already type-valid configuration. Names variables, never values. */
export type ProductionRule = (config: EnvironmentVariables) => Violation[];

/** `.env.example` ships a secret with this prefix; it must never reach production. */
export const LOCAL_SECRET_PREFIX = 'local-dev-';

export const secretIsNotTheLocalPlaceholder: ProductionRule = (config) =>
  config.BETTER_AUTH_SECRET.startsWith(LOCAL_SECRET_PREFIX)
    ? [
        {
          variable: 'BETTER_AUTH_SECRET',
          message: 'must not be the local placeholder from .env.example',
        },
      ]
    : [];

/** Applied only when APP_ENV=production. Add one entry per rule; validate() never changes. */
export const productionRules: ProductionRule[] = [
  secretIsNotTheLocalPlaceholder,
];
