export const JEST_DEFAULT_TIMEOUT = 5_000;

export function effectiveTimeout(): number {
  const stored = (globalThis as Record<symbol, unknown>)[
    Symbol.for('TEST_TIMEOUT_SYMBOL')
  ];
  return typeof stored === 'number' ? stored : JEST_DEFAULT_TIMEOUT;
}
