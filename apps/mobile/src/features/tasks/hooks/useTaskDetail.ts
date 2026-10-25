import {
  useTasksGet,
  type TaskResponseDto,
  type TasksList200,
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
    .findAll({ queryKey: qk.tasks.lists() })) {
    const data = query.state.data as InfiniteData<TasksList200> | undefined;
    const task = data?.pages
      ?.flatMap((page) => page.data)
      .find((candidate) => candidate.id === id);
    if (task) {
      return { task, updatedAt: query.state.dataUpdatedAt };
    }
  }
  return undefined;
}

export function useTaskDetail(id: string | undefined) {
  const queryClient = useQueryClient();
  const cached = id ? fromLists(queryClient, id) : undefined;
  return useTasksGet(id ?? '', {
    query: {
      queryKey: qk.tasks.detail(id ?? ''),
      enabled: Boolean(id),
      initialData: cached && { data: cached.task },
      initialDataUpdatedAt: cached?.updatedAt,
      select: (response): TaskResponseDto => response.data,
    },
  });
}
