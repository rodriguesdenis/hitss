import { Writable } from 'node:stream';

/** In-memory pino destination: parsed JSON lines, plus the raw text for leak scans. */
export class LogCapture extends Writable {
  private text = '';

  override _write(chunk: Buffer, _encoding: string, done: () => void): void {
    this.text += chunk.toString();
    done();
  }

  /**
   * Resolves once a line matching `predicate` exists. pino-http writes the completion line on the
   * response's `finish` event, which can land after the client has its response, so tests wait
   * for the line instead of reading it right away.
   */
  async waitFor(
    predicate: (line: Record<string, unknown>) => boolean,
    timeoutMs = 3000,
  ): Promise<Record<string, unknown>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.lines.find(predicate);
      if (found) return found;
      if (Date.now() > deadline)
        throw new Error('timed out waiting for a log line');
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
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
