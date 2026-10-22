import { hasNextPage, PageRequest } from '../application/page';
import type { PageMeta } from './openapi/api-envelope';

/** The `meta` of a list response (ADR-0006, BR-02.10). */
export function toPageMeta(
  request: PageRequest,
  returned: number,
  total: number,
): PageMeta {
  return {
    total,
    limit: request.limit,
    offset: request.offset,
    hasNextPage: hasNextPage(request, returned, total),
  };
}
