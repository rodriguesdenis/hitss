export const DATABASE_PROBE_TIMEOUT_MS = 10_000;

export const POOL_CLOSE_GRACE_MS = 1_000;

export const PG_CONNECTION_TIMEOUT_MS = 2_000;
export const PG_QUERY_TIMEOUT_MS = 5_000;

export function pgPoolConfig(connectionString: string) {
  return {
    connectionString,
    connectionTimeoutMillis: PG_CONNECTION_TIMEOUT_MS,
    query_timeout: PG_QUERY_TIMEOUT_MS,
  };
}

export async function settleWithin(
  work: Promise<unknown>,
  ms: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  await Promise.race([
    work.then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  ]);
  clearTimeout(timer);
}

export const DATABASE_PROBE_TIMEOUT = Symbol('DATABASE_PROBE_TIMEOUT');

const SAFE_CODE = /^[A-Z0-9_]{1,32}$/;
const ADVICE = 'Check DATABASE_URL and that PostgreSQL is running.';

export class DatabaseUnavailableError extends Error {
  constructor(reason: string) {
    super(`Database unreachable${reason}. ${ADVICE}`);
    this.name = 'DatabaseUnavailableError';
  }
}

export async function probeDatabase(
  query: () => Promise<unknown>,
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new DatabaseUnavailableError(
            `: no answer within ${Math.round(timeoutMs / 1000)} s`,
          ),
        ),
      timeoutMs,
    );
  });
  try {
    await Promise.race([
      query().catch((error: unknown) => {
        const code = codeOf(error);
        throw new DatabaseUnavailableError(code ? ` (${code})` : '');
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function codeOf(error: unknown): string | undefined {
  const candidate =
    readPath(error, ['meta', 'driverAdapterError', 'cause', 'originalCode']) ??
    readPath(error, ['code']);
  return typeof candidate === 'string' && SAFE_CODE.test(candidate)
    ? candidate
    : undefined;
}

function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
