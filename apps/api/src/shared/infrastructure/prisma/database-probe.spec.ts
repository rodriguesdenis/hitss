import {
  DATABASE_PROBE_TIMEOUT_MS,
  DatabaseUnavailableError,
  pgPoolConfig,
  probeDatabase,
  settleWithin,
} from './database-probe';

// Built at runtime, low entropy: only used to prove it never leaks into the error.
const URL_FIXTURE = `postgresql://probe-user:${'x'.repeat(12)}@db.internal:5432/app`;

async function failure(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected the probe to fail');
}

describe('probeDatabase', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves when the probe query answers', async () => {
    await expect(
      probeDatabase(() => Promise.resolve([{ one: 1 }]), 1_000),
    ).resolves.toBeUndefined();
  });

  it('fails within the timeout when the database never answers (VII.3 fail fast)', async () => {
    jest.useFakeTimers();
    const pending = failure(() =>
      probeDatabase(() => new Promise(() => {}), 10_000),
    );

    await jest.advanceTimersByTimeAsync(10_000);
    const error = await pending;

    expect(error).toBeInstanceOf(DatabaseUnavailableError);
    expect(error.message).toBe(
      'Database unreachable: no answer within 10 s. Check DATABASE_URL and that PostgreSQL is running.',
    );
  });

  it('fails with the driver code but never the driver message (it may echo host or user)', async () => {
    const driverError = Object.assign(
      new Error(`connect ECONNREFUSED for ${URL_FIXTURE}`),
      { code: 'ECONNREFUSED' },
    );

    const error = await failure(() =>
      probeDatabase(() => Promise.reject(driverError), 1_000),
    );

    expect(error).toBeInstanceOf(DatabaseUnavailableError);
    expect(error.message).toBe(
      'Database unreachable (ECONNREFUSED). Check DATABASE_URL and that PostgreSQL is running.',
    );
    expect(error.message).not.toContain('db.internal');
    expect(JSON.stringify(error)).not.toContain('probe-user');
    expect(error.cause).toBeUndefined();
  });

  it('reads the SQLSTATE of a Prisma driver-adapter error (e.g. a refused password)', async () => {
    const prismaError = Object.assign(new Error('Authentication failed'), {
      meta: { driverAdapterError: { cause: { originalCode: '28P01' } } },
    });

    const error = await failure(() =>
      probeDatabase(() => Promise.reject(prismaError), 1_000),
    );

    expect(error.message).toBe(
      'Database unreachable (28P01). Check DATABASE_URL and that PostgreSQL is running.',
    );
  });

  it('ignores a code that is not a plain identifier', async () => {
    const odd = Object.assign(new Error('x'), {
      code: `bad code ${URL_FIXTURE}`,
    });

    const error = await failure(() =>
      probeDatabase(() => Promise.reject(odd), 1_000),
    );

    expect(error.message).toBe(
      'Database unreachable. Check DATABASE_URL and that PostgreSQL is running.',
    );
  });

  it('bounds startup at 10 seconds by default', () => {
    expect(DATABASE_PROBE_TIMEOUT_MS).toBe(10_000);
  });
});

describe('settleWithin', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves when the work settles, even if it rejects', async () => {
    await expect(
      settleWithin(Promise.reject(new Error('x')), 1_000),
    ).resolves.toBeUndefined();
  });

  it('gives up after the bound when the work never settles', async () => {
    jest.useFakeTimers();
    let done = false;
    const waiting = settleWithin(new Promise(() => {}), 1_000).then(() => {
      done = true;
    });

    await jest.advanceTimersByTimeAsync(999);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await waiting;
    expect(done).toBe(true);
  });
});

describe('pgPoolConfig', () => {
  it('AC-06.1.4 bounds connecting at 2 s and queries at 5 s, so a stuck attempt ends on its own', () => {
    expect(pgPoolConfig('postgresql://u:p@h:5432/db')).toEqual({
      connectionString: 'postgresql://u:p@h:5432/db',
      connectionTimeoutMillis: 2000,
      query_timeout: 5000,
    });
  });
});
