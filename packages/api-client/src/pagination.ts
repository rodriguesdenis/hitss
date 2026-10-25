import type { PageMeta } from './generated/model/index.ts';

export const offsetPagination = {
  initialPageParam: 0 as number | undefined,
  getNextPageParam: ({ meta }: { meta: PageMeta }): number | undefined =>
    meta.hasNextPage ? meta.offset + meta.limit : undefined,
};
