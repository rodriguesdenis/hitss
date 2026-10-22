import {
  DATABASE_READINESS_TIMEOUT_MS,
  DatabaseReadiness,
} from './database-readiness';

type Query = () => Promise<unknown>;

const readiness = (query: Query, timeoutMs = 50) =>
  new DatabaseReadiness({ $queryRaw: query } as never, timeoutMs);

describe('DatabaseReadiness', () => {
  it('AC-06.1.2 reports the database up when SELECT 1 answers', async () => {
    await expect(
      readiness(() => Promise.resolve([{ one: 1 }])).check(),
    ).resolves.toBe(true);
  });

  it('AC-06.1.3 reports it down when the query fails, without throwing', async () => {
    await expect(
      readiness(() =>
        Promise.reject(new Error('connect ECONNREFUSED 10.0.0.9:5432')),
      ).check(),
    ).resolves.toBe(false);
  });

  it('AC-06.1.3 reports it down within the bound when the database hangs', async () => {
    const started = Date.now();
    await expect(
      readiness(() => new Promise(() => undefined), 40).check(),
    ).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('AC-06.1.3 the default bound is 1.5 s, inside the 2 s the spec allows', () => {
    expect(DATABASE_READINESS_TIMEOUT_MS).toBe(1500);
  });

  it('AC-06.1.4 recovers without a restart once the query answers again', async () => {
    let up = false;
    const probe = readiness(() =>
      up ? Promise.resolve([]) : Promise.reject(new Error('down')),
    );
    await expect(probe.check()).resolves.toBe(false);
    up = true;
    await expect(probe.check()).resolves.toBe(true);
  });

  it('AC-06.1.3 never has more than one query outstanding, so probes cannot pile up on a hung pool', async () => {
    const query = jest.fn<Promise<unknown>, []>(
      () => new Promise(() => undefined),
    );
    const probe = readiness(query, 20);

    const results = await Promise.all([
      probe.check(),
      probe.check(),
      probe.check(),
    ]);
    await probe.check();
    await probe.check();

    expect(results).toEqual([false, false, false]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('AC-06.1.4 a hung query that finally fails does not block the next probe nor leak a rejection', async () => {
    let fail: (error: Error) => void = () => undefined;
    const query = jest
      .fn<Promise<unknown>, []>()
      .mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)))
      .mockResolvedValue([]);
    const probe = readiness(query, 20);
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    await expect(probe.check()).resolves.toBe(false);
    fail(new Error('connection timeout'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(probe.check()).resolves.toBe(true);

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
