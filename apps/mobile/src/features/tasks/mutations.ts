import {
  tasksChangeStatus,
  tasksCreate,
  tasksDelete,
  tasksReplace,
  type CreateTaskDto,
  type TaskResponseDto,
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
  cancelRoot,
  defineDurableMutation,
  discardMessage,
  isAlreadyGone,
  resolveId,
  restoreEntity,
  snapshotEntity,
  useSyncStore,
  warnDiscarded,
  type Discard,
  type EntitySnapshot,
} from '@/offline';
import { showToast } from '@/ui';

import {
  adjustTaskCounts,
  applyStatus,
  buildTempTask,
  confirmTask,
  findTask,
  insertTask,
  mergeTask,
  removeTask,
} from './optimistic';

export type TaskCreateVars = { tempId: string; body: CreateTaskDto };
export type TaskUpdateVars = { id: string; body: UpdateTaskDto };
export type TaskStatusVars = { id: string; status: TaskStatus; title: string };
export type TaskDeleteVars = { id: string; title: string };

type Task = TaskResponseDto;

type Context = {
  queued: boolean;
  snapshot?: EntitySnapshot<Task>;
  teamIds?: string[];
  added?: string[];
  removed?: string[];
};

const isQueued = () => !onlineManager.isOnline();

const resolveTeams = (teamIds: string[] | undefined) => teamIds?.map(resolveId);

function undo(
  queryClient: QueryClient,
  reason: Discard,
  context: Context | undefined,
  id: string,
): void {
  if (reason === 'gone') {
    removeTask(queryClient, id);
    return;
  }
  if (context?.snapshot) {
    restoreEntity(queryClient, 'tasks', context.snapshot);
  }
}

export function registerTaskMutationDefaults(queryClient: QueryClient): void {
  defineDurableMutation<TaskCreateVars, TasksCreate201, Context>(
    queryClient,
    mk.tasks.create,
    {
      kind: 'create',
      mutationFn: ({ body }) =>
        tasksCreate({
          ...body,
          ...(body.teamIds ? { teamIds: resolveTeams(body.teamIds) } : {}),
        }),
      onMutate: async ({ tempId, body }) => {
        await cancelRoot(queryClient, 'tasks');
        const task = buildTempTask(queryClient, tempId, body);
        insertTask(queryClient, task);
        return { queued: isQueued(), teamIds: task.teams.map((t) => t.id) };
      },
      onSuccess: (response, { tempId }, context) => {
        const task = (response as TasksCreate201).data;
        useSyncStore.getState().mapId(tempId, task.id);
        confirmTask(queryClient, tempId, task);
        if (!context?.queued) {
          showToast({ message: 'Tarefa criada' });
        }
      },
      onDiscard: (reason, error, { tempId, body }, context) => {
        removeTask(queryClient, tempId);
        adjustTaskCounts(queryClient, context?.teamIds ?? [], -1);
        if (context?.queued) {
          warnDiscarded(discardMessage(reason, error, body.title));
        }
      },
      afterDrain: () =>
        applyCacheEffects(queryClient, 'tasks.create', { id: '' }),
    },
  );

  defineDurableMutation<TaskUpdateVars, TasksReplace200, Context>(
    queryClient,
    mk.tasks.update,
    {
      kind: 'update',
      mutationFn: ({ id, body }) =>
        tasksReplace(resolveId(id), {
          ...body,
          teamIds: resolveTeams(body.teamIds) ?? [],
        }),
      onMutate: async ({ id, body }) => {
        await cancelRoot(queryClient, 'tasks');
        const snapshot = snapshotEntity<Task>(queryClient, 'tasks', id);
        const previous = findTask(queryClient, id);
        if (previous) {
          const merged = mergeTask(queryClient, previous, body);
          const before = previous.teams.map((t) => t.id);
          const after = merged.teams.map((t) => t.id);
          return {
            queued: isQueued(),
            snapshot,
            added: after.filter((t) => !before.includes(t)),
            removed: before.filter((t) => !after.includes(t)),
          };
        }
        return { queued: isQueued(), snapshot };
      },
      onSuccess: (response, { id }, context) => {
        queryClient.setQueryData(qk.tasks.detail(resolveId(id)), response);
        if (!context?.queued) {
          showToast({ message: 'Alterações salvas' });
        }
      },
      onDiscard: (reason, error, { id, body }, context) => {
        undo(queryClient, reason, context, id);
        if (reason !== 'gone') {
          adjustTaskCounts(queryClient, context?.added ?? [], -1);
          adjustTaskCounts(queryClient, context?.removed ?? [], 1);
        }
        if (context?.queued || reason === 'gone') {
          warnDiscarded(discardMessage(reason, error, body.title));
        }
      },
      afterDrain: ({ id }) =>
        applyCacheEffects(queryClient, 'tasks.update', { id }),
    },
  );

  defineDurableMutation<TaskStatusVars, TasksChangeStatus200, Context>(
    queryClient,
    mk.tasks.changeStatus,
    {
      kind: 'status',
      mutationFn: ({ id, status }) =>
        tasksChangeStatus(resolveId(id), { status }),
      onMutate: async ({ id, status }) => {
        await cancelRoot(queryClient, 'tasks');
        const snapshot = snapshotEntity<Task>(queryClient, 'tasks', id);
        applyStatus(queryClient, id, status);
        return { queued: isQueued(), snapshot };
      },
      onSuccess: (response, { id }) => {
        queryClient.setQueryData(qk.tasks.detail(resolveId(id)), response);
      },
      onDiscard: (reason, error, { id, title }, context) => {
        undo(queryClient, reason, context, id);
        warnDiscarded(discardMessage(reason, error, title));
      },
      afterDrain: ({ id }) =>
        applyCacheEffects(queryClient, 'tasks.changeStatus', { id }),
    },
  );

  defineDurableMutation<TaskDeleteVars, void, Context>(
    queryClient,
    mk.tasks.delete,
    {
      kind: 'delete',
      mutationFn: ({ id }) => tasksDelete(resolveId(id)),
      onMutate: async ({ id }) => {
        await cancelRoot(queryClient, 'tasks');
        const snapshot = snapshotEntity<Task>(queryClient, 'tasks', id);
        const teamIds = (findTask(queryClient, id)?.teams ?? []).map(
          (t) => t.id,
        );
        removeTask(queryClient, id);
        adjustTaskCounts(queryClient, teamIds, -1);
        return { queued: isQueued(), snapshot, teamIds };
      },
      onSuccess: (response, _vars, context) => {
        if (!context?.queued && !isAlreadyGone(response)) {
          showToast({ message: 'Tarefa excluída' });
        }
      },
      onDiscard: (reason, error, { title }, context) => {
        if (context?.snapshot) {
          restoreEntity(queryClient, 'tasks', context.snapshot);
        }
        adjustTaskCounts(queryClient, context?.teamIds ?? [], 1);
        warnDiscarded(discardMessage(reason, error, title));
      },
      afterDrain: ({ id }) =>
        applyCacheEffects(queryClient, 'tasks.delete', { id }),
    },
  );
}
