import type { TasksListParams, TeamsListParams } from '@hitss/api-client';

export const qk = {
  teams: {
    all: ['teams'] as const,
    lists: () => [...qk.teams.all, 'list'] as const,
    list: (params: TeamsListParams) => [...qk.teams.lists(), params] as const,
    detail: (id: string) => [...qk.teams.all, 'detail', id] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    lists: () => [...qk.tasks.all, 'list'] as const,
    list: (params: TasksListParams) => [...qk.tasks.lists(), params] as const,
    detail: (id: string) => [...qk.tasks.all, 'detail', id] as const,
  },
};

export const mk = {
  tasks: {
    create: ['tasks', 'create'] as const,
    update: ['tasks', 'update'] as const,
    changeStatus: ['tasks', 'changeStatus'] as const,
    delete: ['tasks', 'delete'] as const,
  },
  teams: {
    create: ['teams', 'create'] as const,
    update: ['teams', 'update'] as const,
    delete: ['teams', 'delete'] as const,
  },
};
