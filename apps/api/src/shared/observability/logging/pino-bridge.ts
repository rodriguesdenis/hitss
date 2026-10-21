import type { Logger } from 'pino';

type BridgeLevel = 'debug' | 'info' | 'warn' | 'error';

/** Shape of the Better Auth `logger` option the bridge implements. */
export interface AuthLogger {
  level: BridgeLevel;
  log: (level: BridgeLevel, message: string, ...args: unknown[]) => void;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Routes Better Auth output into pino at `warn` or above (S-M8). Only object arguments are
 * forwarded, nested under `details` so the logger's redaction paths apply at any depth;
 * strings and numbers could carry tokens and are dropped (AC-06.3.8).
 */
export function createAuthLogger(
  logger: Pick<Logger, 'warn' | 'error' | 'info' | 'debug'>,
  level: BridgeLevel = 'warn',
): AuthLogger {
  return {
    level,
    log(entryLevel, message, ...args) {
      const details = args.filter(isPlainObject);
      const target =
        entryLevel === 'info' || entryLevel === 'debug' ? 'warn' : entryLevel;
      logger[target]({ source: 'better-auth', details }, message);
    },
  };
}
