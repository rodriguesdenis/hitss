import { Writable } from 'node:stream';

/** In-memory pino destination: parsed JSON lines, plus the raw text for leak scans. */
export class LogCapture extends Writable {
  private text = '';
  private readonly waiters = new Set<() => boolean>();

  override _write(chunk: Buffer, _encoding: string, done: () => void): void {
    this.text += chunk.toString();
    for (const check of [...this.waiters]) check();
    done();
  }

  /**
   * Resolves once a line matching `predicate` exists. pino-http writes the completion line on the
   * response's `finish` event, which can land after the client has its response, so tests wait
   * for the line instead of reading it right away. Waiters are checked on every write.
   */
  waitFor(
    predicate: (line: Record<string, unknown>) => boolean,
    timeoutMs = 3000,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = this.lines.find(predicate);
        if (!found) return false;
        cleanup();
        resolve(found);
        return true;
      };
      const timer = setTimeout(() => {
        cleanup();
        const seen = this.lines
          .slice(0, 3)
          .map(
            (l) =>
              `${String(l.msg)} ${String((l.req as { url?: string } | undefined)?.url)}`,
          );
        reject(
          new Error(
            `timed out waiting for a log line; saw ${this.lines.length} lines, first 3: ${seen.join(' | ')}`,
          ),
        );
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        this.waiters.delete(check);
      };
      if (!check()) this.waiters.add(check);
    });
  }

  reset(): void {
    this.text = '';
  }

  get raw(): string {
    return this.text;
  }

  get lines(): Record<string, unknown>[] {
    return this.text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}
