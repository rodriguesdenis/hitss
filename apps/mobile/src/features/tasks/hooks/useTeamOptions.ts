import {
  offsetPagination,
  useTeamsListInfinite,
  type TeamsListParams,
} from '@hitss/api-client';

import { qk } from '@/lib/query-keys';

const params: TeamsListParams = { limit: 100, sort: 'name' };

export function useTeamOptions() {
  const query = useTeamsListInfinite(params, {
    query: { queryKey: qk.teams.list(params), ...offsetPagination },
  });
  return {
    ...query,
    teams: query.data?.pages.flatMap((page) => page.data) ?? [],
  };
}
