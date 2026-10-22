import type { Sort } from '../application/page';

/** The accepted `sort` values: each field ascending (`name`) and descending (`-name`). */
export function sortValues<F extends string>(fields: readonly F[]): string[] {
  return fields.flatMap((field) => [field, `-${field}`]);
}

/** `-createdAt` → `{ field: 'createdAt', direction: 'desc' }`. The DTO has already checked it. */
export function parseSort<F extends string>(value: F | `-${F}`): Sort<F> {
  return value.startsWith('-')
    ? { field: value.slice(1) as F, direction: 'desc' }
    : { field: value as F, direction: 'asc' };
}
