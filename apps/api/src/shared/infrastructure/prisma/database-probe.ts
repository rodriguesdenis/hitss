/**
 * Startup bound for the database probe (constitution VII.3: fail fast). The pg driver adapter
 * opens no connection on $connect, so without a probe the API would start "healthy" against an
 * unreachable database and fail on the first request. 10 s covers a database still accepting
 * connections after compose's healthcheck, yet stops a misconfigured API quickly.
 */
export const DATABASE_PROBE_TIMEOUT_MS = 10_000;

/**
 * How long a failed boot waits for the pool to close before giving up. Closing waits for pending
 * connection attempts, and against a database that never answers those only end at the OS TCP
 * timeout; an unbounded wait would turn fail fast into a hang.
 */
export const POOL_CLOSE_GRACE_MS = 1_000;

/**
 * Bounds on the pg driver itself, so no attempt hangs for the OS TCP timeout (minutes) against a
 * black-holed database: opening a connection gives up after 2 s and a query after 5 s (client
 * side). Readiness waits on one outstanding attempt, so these also decide how soon `/ready`
 * recovers after the database comes back.
 */
export const PG_CONNECTION_TIMEOUT_MS = 2_000;
export const PG_QUERY_TIMEOUT_MS = 5_000;

/** Pool settings the PrismaPg adapter passes to `pg` (connection string plus the bounds above). */
export function pgPoolConfig(connectionString: string) {
  return {
    connectionString,
    connectionTimeoutMillis: PG_CONNECTION_TIMEOUT_MS,
    query_timeout: PG_QUERY_TIMEOUT_MS,
  };
}

/** Waits for `work` (errors ignored) for at most `ms`; never rejects. */
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

/** DI token for the probe bound; PrismaModule provides the default, tests may shorten it. */
export const DATABASE_PROBE_TIMEOUT = Symbol('DATABASE_PROBE_TIMEOUT');

const SAFE_CODE = /^[A-Z0-9_]{1,32}$/;
const ADVICE = 'Check DATABASE_URL and that PostgreSQL is running.';

/**
 * The database did not answer the startup probe. The message names the setting, never its
 * value, and carries at most a driver/SQLSTATE code: driver messages can echo host or user.
 */
export class DatabaseUnavailableError extends Error {
  constructor(reason: string) {
    super(`Database unreachable${reason}. ${ADVICE}`);
    this.name = 'DatabaseUnavailableError';
  }
}

/** Runs `query` (e.g. SELECT 1) and fails with DatabaseUnavailableError if it errors or hangs. */
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

/** A Node/pg error code or the SQLSTATE inside a Prisma driver-adapter error, if well-formed. */
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
