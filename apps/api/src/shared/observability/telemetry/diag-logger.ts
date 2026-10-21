import type { DiagLogger } from '@opentelemetry/api';

export const DIAG_DEDUP_WINDOW_MS = 60_000;

interface Options {
  warn: (message: string) => void;
  now?: () => number;
  windowMs?: number;
}

/**
 * OTel `diag` logger that turns export failures into at most one warning per window (AC-06.5.2).
 * Only a fixed message is emitted: error details can echo endpoints or headers, so they are dropped.
 */
export function createDedupDiagLogger({
  warn,
  now = Date.now,
  windowMs = DIAG_DEDUP_WINDOW_MS,
}: Options): DiagLogger {
  let lastEmitted = -Infinity;
  let suppressed = 0;

  const report = () => {
    const at = now();
    if (at - lastEmitted < windowMs) {
      suppressed += 1;
      return;
    }
    const extra = suppressed > 0 ? ` (${suppressed} similar suppressed)` : '';
    suppressed = 0;
    lastEmitted = at;
    warn(`telemetry export problem; telemetry may be dropped${extra}`);
  };
  const ignore = () => undefined;

  return {
    error: report,
    warn: report,
    info: ignore,
    debug: ignore,
    verbose: ignore,
  };
}
