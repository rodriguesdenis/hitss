import { Writable } from 'node:stream';

/** In-memory pino destination: parsed JSON lines, plus the raw text for leak scans. */
export class LogCapture extends Writable {
  private text = '';

  override _write(chunk: Buffer, _encoding: string, done: () => void): void {
    this.text += chunk.toString();
    done();
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
