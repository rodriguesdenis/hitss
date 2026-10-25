import type {
  ApiError,
  ApiErrorResponseDto,
  TasksChangeStatus200,
  TasksCreate201,
  TasksReplace200,
} from '@hitss/api-client';
import { useMutation } from '@tanstack/react-query';

import { mk } from '@/lib/query-keys';

import type {
  TaskCreateVars,
  TaskDeleteVars,
  TaskStatusVars,
  TaskUpdateVars,
} from '../mutations';

export type CreateTaskVariables = TaskCreateVars;
export type UpdateTaskVariables = TaskUpdateVars;
export type ChangeTaskStatusVariables = TaskStatusVars;
export type DeleteTaskVariables = TaskDeleteVars;

type Failure = ApiError<ApiErrorResponseDto>;

export function useCreateTask() {
  return useMutation<TasksCreate201, Failure, TaskCreateVars>({
    mutationKey: mk.tasks.create,
  });
}

export function useUpdateTask() {
  return useMutation<TasksReplace200, Failure, TaskUpdateVars>({
    mutationKey: mk.tasks.update,
  });
}

export function useChangeTaskStatus() {
  return useMutation<TasksChangeStatus200, Failure, TaskStatusVars>({
    mutationKey: mk.tasks.changeStatus,
  });
}

export function useDeleteTask() {
  return useMutation<unknown, Failure, TaskDeleteVars>({
    mutationKey: mk.tasks.delete,
  });
}
