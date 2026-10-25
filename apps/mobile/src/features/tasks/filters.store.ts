import type { TaskStatus } from '@hitss/api-client';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { onSessionReset } from '@/lib/session-reset';

export type StatusFilter = TaskStatus | 'ALL';

export const GLOBAL_SCOPE = 'all';

export interface TaskFilters {
  status: StatusFilter;
  search: string;
}

export const emptyFilters: TaskFilters = { status: 'ALL', search: '' };

interface FiltersState {
  byScope: Record<string, TaskFilters>;
  setStatus: (scope: string, status: StatusFilter) => void;
  setSearch: (scope: string, search: string) => void;
  clear: (scope: string) => void;
  reset: () => void;
}

export const useTaskFiltersStore = create<FiltersState>()(
  immer((set) => ({
    byScope: {},
    setStatus: (scope, status) =>
      set((state) => {
        state.byScope[scope] = {
          ...(state.byScope[scope] ?? emptyFilters),
          status,
        };
      }),
    setSearch: (scope, search) =>
      set((state) => {
        state.byScope[scope] = {
          ...(state.byScope[scope] ?? emptyFilters),
          search,
        };
      }),
    clear: (scope) =>
      set((state) => {
        delete state.byScope[scope];
      }),
    reset: () =>
      set((state) => {
        state.byScope = {};
      }),
  })),
);

onSessionReset(() => useTaskFiltersStore.getState().reset());

export function useTaskFilters(scope: string): TaskFilters {
  return useTaskFiltersStore((state) => state.byScope[scope] ?? emptyFilters);
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return filters.status !== 'ALL' || filters.search.trim() !== '';
}
