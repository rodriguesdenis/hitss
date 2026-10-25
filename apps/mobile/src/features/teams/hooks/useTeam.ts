import {
  useTeamsFindOne,
  type TeamResponseDto,
  type TeamsList200,
} from '@hitss/api-client';
import {
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

function fromLists(queryClient: QueryClient, id: string) {
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: qk.teams.lists() })) {
    const data = query.state.data as InfiniteData<TeamsList200> | undefined;
    const team = data?.pages
      .flatMap((page) => page.data)
      .find((candidate) => candidate.id === id);
    if (team) {
      return { team, updatedAt: query.state.dataUpdatedAt };
    }
  }
  return undefined;
}

export function useTeam(id: string | undefined) {
  const queryClient = useQueryClient();
  const cached = id ? fromLists(queryClient, id) : undefined;
  return useTeamsFindOne(id ?? '', {
    query: {
      queryKey: qk.teams.detail(id ?? ''),
      enabled: Boolean(id),
      initialData: cached && { data: cached.team },
      initialDataUpdatedAt: cached?.updatedAt,
      select: (response): TeamResponseDto => response.data,
    },
  });
}
