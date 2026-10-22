/** Offset pagination (ADR-0006): what the caller asks for. */
export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

/** One page of results and the total number of matches (for `meta`). */
export interface Page<T> {
  readonly items: T[];
  readonly total: number;
}

export type SortDirection = 'asc' | 'desc';

/** A whitelisted sort field and its direction; ties are always broken by id. */
export interface Sort<F extends string> {
  readonly field: F;
  readonly direction: SortDirection;
}

/** BR-02.10: `hasNextPage = offset + returned < total`. */
export function hasNextPage(
  request: PageRequest,
  returned: number,
  total: number,
): boolean {
  return request.offset + returned < total;
}
