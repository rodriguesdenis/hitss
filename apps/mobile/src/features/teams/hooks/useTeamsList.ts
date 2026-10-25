import {
  offsetPagination,
  useTeamsListInfinite,
  type TeamsListParams,
} from '@hitss/api-client';
import { keepPreviousData } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useDebouncedValue } from '@/ui';

export const TEAMS_PAGE_SIZE = 20;

export function teamsListParams(search: string): TeamsListParams {
  const term = search.trim();
  return {
    limit: TEAMS_PAGE_SIZE,
    sort: 'name',
    ...(term ? { search: term } : {}),
  };
}

export function useTeamsInfiniteList(search: string) {
  const params = teamsListParams(useDebouncedValue(search));
  const query = useTeamsListInfinite(params, {
    query: {
      queryKey: qk.teams.list(params),
      ...offsetPagination,
      placeholderData: keepPreviousData,
    },
  });
  const pages = query.data?.pages ?? [];
  return {
    ...query,
    params,
    teams: pages.flatMap((page) => page.data),
    total: pages.at(-1)?.meta.total ?? 0,
  };
}
