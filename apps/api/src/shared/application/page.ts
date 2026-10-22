export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface Page<T> {
  readonly items: T[];
  readonly total: number;
}

export type SortDirection = 'asc' | 'desc';

export interface Sort<F extends string> {
  readonly field: F;
  readonly direction: SortDirection;
}

export function hasNextPage(
  request: PageRequest,
  returned: number,
  total: number,
): boolean {
  return request.offset + returned < total;
}
