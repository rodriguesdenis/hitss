import {
  tasksChangeStatus,
  tasksCreate,
  tasksDelete,
  tasksReplace,
  type CreateTaskDto,
  type TaskStatus,
  type UpdateTaskDto,
} from '@hitss/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { applyCacheEffects } from '@/lib/cache-effects';
import { errorMessage } from '@/lib/error-messages';
import { mk } from '@/lib/query-keys';
import { showToast } from '@/ui';

export type CreateTaskVariables = { tempId: string; body: CreateTaskDto };
export type UpdateTaskVariables = { id: string; body: UpdateTaskDto };
export type ChangeTaskStatusVariables = {
  id: string;
  status: TaskStatus;
  title: string;
};
export type DeleteTaskVariables = { id: string; title: string };

function showError(error: unknown) {
  showToast({ message: errorMessage(error), tone: 'error' });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mk.tasks.create,
    mutationFn: ({ body }: CreateTaskVariables) => tasksCreate(body),
    onSuccess: async (response) => {
      showToast({ message: 'Tarefa criada' });
      await applyCacheEffects(queryClient, 'tasks.create', {
        id: response.data.id,
        response,
      });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mk.tasks.update,
    mutationFn: ({ id, body }: UpdateTaskVariables) => tasksReplace(id, body),
    onSuccess: async (response, { id }) => {
      showToast({ message: 'Alterações salvas' });
      await applyCacheEffects(queryClient, 'tasks.update', { id, response });
    },
  });
}

export function useChangeTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mk.tasks.changeStatus,
    mutationFn: ({ id, status }: ChangeTaskStatusVariables) =>
      tasksChangeStatus(id, { status }),
    onSuccess: async (response, { id }) => {
      await applyCacheEffects(queryClient, 'tasks.changeStatus', {
        id,
        response,
      });
    },
    onError: showError,
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mk.tasks.delete,
    mutationFn: ({ id }: DeleteTaskVariables) => tasksDelete(id),
    onSuccess: async (_response, { id }) => {
      showToast({ message: 'Tarefa excluída' });
      await applyCacheEffects(queryClient, 'tasks.delete', { id });
    },
    onError: showError,
  });
}
