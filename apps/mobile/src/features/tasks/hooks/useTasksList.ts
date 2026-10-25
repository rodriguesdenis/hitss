import {
  offsetPagination,
  useTasksListInfinite,
  type TasksListParams,
} from '@hitss/api-client';
import { keepPreviousData } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { SEARCH_MAX_LENGTH, useDebouncedValue } from '@/ui';

import type { TaskFilters } from '../filters.store';

export const TASKS_PAGE_SIZE = 20;

export function tasksListParams(
  teamId: string | undefined,
  { status, search }: TaskFilters,
): TasksListParams {
  const term = search.trim().slice(0, SEARCH_MAX_LENGTH);
  return {
    limit: TASKS_PAGE_SIZE,
    sort: '-createdAt',
    ...(teamId ? { teamId } : {}),
    ...(status !== 'ALL' ? { status: [status] } : {}),
    ...(term ? { search: term } : {}),
  };
}

export function useTasksInfiniteList(
  teamId: string | undefined,
  filters: TaskFilters,
) {
  const search = useDebouncedValue(filters.search);
  const params = tasksListParams(teamId, { ...filters, search });
  const query = useTasksListInfinite(params, {
    query: {
      queryKey: qk.tasks.list(params),
      ...offsetPagination,
      placeholderData: keepPreviousData,
    },
  });
  const pages = query.data?.pages ?? [];
  return {
    ...query,
    params,
    tasks: pages.flatMap((page) => page.data),
    total: pages.at(-1)?.meta.total ?? 0,
  };
}
