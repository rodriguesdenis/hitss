/**
 * NOTE: `Symbol.for('TEST_TIMEOUT_SYMBOL')` is an internal of jest-circus (it is what
 * `jest.setTimeout()` stores and what the runner reads at run start). It is verified on Jest 30.5;
 * if a Jest upgrade changes it, the jest-timeout specs of the three projects fail and this helper
 * must be revisited.
 *
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
