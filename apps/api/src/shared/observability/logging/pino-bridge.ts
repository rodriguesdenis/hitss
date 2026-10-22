import type { Logger } from 'pino';

type BridgeLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AuthLogger {
  level: BridgeLevel;
  log: (level: BridgeLevel, message: string, ...args: unknown[]) => void;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const DETAIL_FIELDS = ['code', 'status', 'statusCode', 'name'] as const;

export function sanitizeLogText(text: string): string {
  return text
    .replace(/(https?:\/\/[^\s?#]+)[?#]\S*/g, '$1')
    .replace(/[^\s@]+@[^\s@]+/g, '[email]');
}

function pickDetails(args: unknown[]): Record<string, string | number>[] {
  return args.filter(isPlainObject).map((arg) => {
    const picked: Record<string, string | number> = {};
    for (const field of DETAIL_FIELDS) {
      const value = arg[field];
      if (typeof value === 'number') picked[field] = value;
      if (typeof value === 'string') picked[field] = sanitizeLogText(value);
    }
    return picked;
  });
}

export function createAuthLogger(
  logger: Pick<Logger, 'warn' | 'error' | 'info' | 'debug'>,
  level: BridgeLevel = 'warn',
): AuthLogger {
  return {
    level,
    log(entryLevel, message, ...args) {
      logger[entryLevel](
        { source: 'better-auth', details: pickDetails(args) },
        sanitizeLogText(message),
      );
    },
  };
}
