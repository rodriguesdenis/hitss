/**
 * The version a client expects a resource to be at (ADR-0015).
 *
 * - `any`: no precondition (no `If-Match`, or `*`).
 * - `exact`: `If-Match` named a version.
 * - `unmatchable`: `If-Match` was not a recognizable version tag; it never matches.
 */
export type ExpectedVersion =
  | { readonly kind: 'any' }
  | { readonly kind: 'exact'; readonly version: number }
  | { readonly kind: 'unmatchable' };

export const ExpectedVersion = {
  any: (): ExpectedVersion => ({ kind: 'any' }),
  exact: (version: number): ExpectedVersion => ({ kind: 'exact', version }),
  unmatchable: (): ExpectedVersion => ({ kind: 'unmatchable' }),
};

export function matchesVersion(
  expected: ExpectedVersion,
  currentVersion: number,
): boolean {
  switch (expected.kind) {
    case 'any':
      return true;
    case 'exact':
      return expected.version === currentVersion;
    case 'unmatchable':
      return false;
  }
}
