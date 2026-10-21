import { TelemetryLifecycle } from './telemetry-lifecycle';

describe('TelemetryLifecycle', () => {
  it('AC-06.5.4 runs the registered shutdown once, even when called twice', async () => {
    const lifecycle = new TelemetryLifecycle();
    const stop = jest.fn().mockResolvedValue(undefined);
    lifecycle.onShutdown(stop);

    await Promise.all([lifecycle.shutdown(1000), lifecycle.shutdown(1000)]);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('AC-06.5.4 gives up after the timeout instead of hanging the exit', async () => {
    const lifecycle = new TelemetryLifecycle();
    lifecycle.onShutdown(() => new Promise(() => undefined));

    const started = Date.now();
    await lifecycle.shutdown(50);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('AC-06.5.1 swallows shutdown errors: telemetry never breaks exit', async () => {
    const lifecycle = new TelemetryLifecycle();
    lifecycle.onShutdown(() => Promise.reject(new Error('collector gone')));
    await expect(lifecycle.shutdown(100)).resolves.toBeUndefined();
  });

  it('AC-06.5.3 is a no-op when telemetry never started', async () => {
    await expect(
      new TelemetryLifecycle().shutdown(100),
    ).resolves.toBeUndefined();
  });
});
