import {
  tasksChangeStatus,
  tasksCreate,
  tasksDelete,
  tasksReplace,
  type CreateTaskDto,
  type TasksChangeStatus200,
  type TasksCreate201,
  type TaskStatus,
  type TasksReplace200,
  type UpdateTaskDto,
} from '@hitss/api-client';
import { onlineManager, type QueryClient } from '@tanstack/react-query';

import { applyCacheEffects } from '@/lib/cache-effects';
import { mk, qk } from '@/lib/query-keys';
import {
  defineDurableMutation,
  discardMessage,
  isAlreadyGone,
  resolveId,
  useSyncStore,
  warnDiscarded,
} from '@/offline';
import { showToast } from '@/ui';

export type TaskCreateVars = { tempId: string; body: CreateTaskDto };
export type TaskUpdateVars = { id: string; body: UpdateTaskDto };
export type TaskStatusVars = { id: string; status: TaskStatus; title: string };
export type TaskDeleteVars = { id: string; title: string };

type Queued = { queued: boolean };

const queued = (): Queued => ({ queued: !onlineManager.isOnline() });

const resolveTeams = (teamIds: string[] | undefined) => teamIds?.map(resolveId);

export function registerTaskMutationDefaults(queryClient: QueryClient): void {
  defineDurableMutation<TaskCreateVars, TasksCreate201, Queued>(
    queryClient,
    mk.tasks.create,
    {
      kind: 'create',
      mutationFn: ({ body }) =>
        tasksCreate({
          ...body,
          ...(body.teamIds ? { teamIds: resolveTeams(body.teamIds) } : {}),
        }),
      onMutate: queued,
      onSuccess: (response, { tempId }, context) => {
        const task = (response as TasksCreate201).data;
        useSyncStore.getState().mapId(tempId, task.id);
        if (!context?.queued) {
          showToast({ message: 'Tarefa criada' });
        }
      },
      onDiscard: (reason, error, { body }, context) =>
        context?.queued &&
        warnDiscarded(discardMessage(reason, error, body.title)),
      afterDrain: () =>
        applyCacheEffects(queryClient, 'tasks.create', { id: '' }),
    },
  );

  defineDurableMutation<TaskUpdateVars, TasksReplace200, Queued>(
    queryClient,
    mk.tasks.update,
    {
      kind: 'update',
      mutationFn: ({ id, body }) =>
        tasksReplace(resolveId(id), {
          ...body,
          teamIds: resolveTeams(body.teamIds) ?? [],
        }),
      onMutate: queued,
      onSuccess: (_response, _vars, context) => {
        if (!context?.queued) {
          showToast({ message: 'Alterações salvas' });
        }
      },
      onDiscard: (reason, error, { body }, context) =>
        context?.queued &&
        warnDiscarded(discardMessage(reason, error, body.title)),
      afterDrain: ({ id }) =>
        applyCacheEffects(queryClient, 'tasks.update', { id }),
    },
  );

  defineDurableMutation<TaskStatusVars, TasksChangeStatus200, Queued>(
    queryClient,
    mk.tasks.changeStatus,
    {
      kind: 'status',
      mutationFn: ({ id, status }) =>
        tasksChangeStatus(resolveId(id), { status }),
      onMutate: queued,
      onSuccess: (response, { id }) => {
        queryClient.setQueryData(qk.tasks.detail(resolveId(id)), response);
      },
      onDiscard: (reason, error, { title }) =>
        warnDiscarded(discardMessage(reason, error, title)),
      afterDrain: ({ id }) =>
        applyCacheEffects(queryClient, 'tasks.changeStatus', { id }),
    },
  );

  defineDurableMutation<TaskDeleteVars, void, Queued>(
    queryClient,
    mk.tasks.delete,
    {
      kind: 'delete',
      mutationFn: ({ id }) => tasksDelete(resolveId(id)),
      onMutate: queued,
      onSuccess: (response, _vars, context) => {
        if (!context?.queued && !isAlreadyGone(response)) {
          showToast({ message: 'Tarefa excluída' });
        }
      },
      onDiscard: (reason, error, { title }) =>
        warnDiscarded(discardMessage(reason, error, title)),
      afterDrain: ({ id }) =>
        applyCacheEffects(queryClient, 'tasks.delete', { id }),
    },
  );
}
