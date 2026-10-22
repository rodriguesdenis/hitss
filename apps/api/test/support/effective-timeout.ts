/**
 * The timeout Jest applies to a test in this project. `jest.setTimeout()` stores it under this
 * symbol; when nothing set it, Jest's default of 5 s is in force. A per-project `testTimeout` option
 * does NOT show up here: Jest 30 reads that option from the global config only.
 */
export const JEST_DEFAULT_TIMEOUT = 5_000;

export function effectiveTimeout(): number {
  const stored = (globalThis as Record<symbol, unknown>)[
    Symbol.for('TEST_TIMEOUT_SYMBOL')
  ];
  return typeof stored === 'number' ? stored : JEST_DEFAULT_TIMEOUT;
}
