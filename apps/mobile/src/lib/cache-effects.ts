import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { qk } from './query-keys';

export type CacheMutation =
  | 'tasks.create'
  | 'tasks.update'
  | 'tasks.changeStatus'
  | 'tasks.delete'
  | 'teams.create'
  | 'teams.update'
  | 'teams.delete';

type Effects = {
  detail?: 'set' | 'remove';
  invalidate: QueryKey[];
};

const effects: Record<CacheMutation, Effects> = {
  'tasks.create': {
    detail: 'set',
    invalidate: [qk.tasks.lists(), qk.teams.lists()],
  },
  'tasks.update': {
    detail: 'set',
    invalidate: [qk.tasks.lists(), qk.teams.lists()],
  },
  'tasks.changeStatus': { detail: 'set', invalidate: [qk.tasks.lists()] },
  'tasks.delete': {
    detail: 'remove',
    invalidate: [qk.tasks.lists(), qk.teams.lists()],
  },
  'teams.create': { invalidate: [qk.teams.lists()] },
  'teams.update': {
    detail: 'set',
    invalidate: [qk.teams.lists(), qk.tasks.all],
  },
  'teams.delete': {
    detail: 'remove',
    invalidate: [qk.teams.lists(), qk.tasks.all],
  },
};

export async function applyCacheEffects(
  queryClient: QueryClient,
  mutation: CacheMutation,
  { id, response }: { id: string; response?: unknown },
): Promise<void> {
  const { detail, invalidate } = effects[mutation];
  const detailKey = mutation.startsWith('tasks.')
    ? qk.tasks.detail(id)
    : qk.teams.detail(id);
  if (detail === 'set' && response !== undefined) {
    queryClient.setQueryData(detailKey, response);
  }
  if (detail === 'remove') {
    queryClient.removeQueries({ queryKey: detailKey, exact: true });
  }
  await Promise.all(
    invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
