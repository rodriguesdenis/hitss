export const TELEMETRY_SHUTDOWN_TIMEOUT_MS = 5_000;

/**
 * Hands the SDK shutdown from `instrumentation.ts` (loaded before Nest) to `main.ts`.
 * Both load this file through the same CommonJS module cache, so they share one instance.
 */
export class TelemetryLifecycle {
  private stop: (() => Promise<void>) | undefined;
  private running: Promise<void> | undefined;

  onShutdown(stop: () => Promise<void>): void {
    this.stop = stop;
  }

  /** Flushes telemetry for at most `timeoutMs`; never rejects and runs the hook once. */
  shutdown(timeoutMs = TELEMETRY_SHUTDOWN_TIMEOUT_MS): Promise<void> {
    this.running ??= this.run(timeoutMs);
    return this.running;
  }

  private async run(timeoutMs: number): Promise<void> {
    if (!this.stop) return;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    try {
      await Promise.race([this.stop().catch(() => undefined), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}

export const telemetryLifecycle = new TelemetryLifecycle();
