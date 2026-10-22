import { hasNextPage, PageRequest } from '../application/page';
import type { PageMeta } from './openapi/api-envelope';

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
