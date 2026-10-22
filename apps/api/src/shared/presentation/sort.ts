import type { Sort } from '../application/page';

export function sortValues<F extends string>(fields: readonly F[]): string[] {
  return fields.flatMap((field) => [field, `-${field}`]);
}

export function parseSort<F extends string>(value: F | `-${F}`): Sort<F> {
  return value.startsWith('-')
    ? { field: value.slice(1) as F, direction: 'desc' }
    : { field: value as F, direction: 'asc' };
}
