import type { DomainErrorMapping } from '../../../shared/presentation/filters/domain-error-mappings';
import { TaskNotFound } from '../domain/task.errors';

/** Plan 003 → Error mapping; registered by TasksModule (fixed messages, never the exception's). */
export const TASK_ERROR_MAPPINGS: readonly DomainErrorMapping[] = [
  {
    error: TaskNotFound,
    status: 404,
    code: 'TASK_NOT_FOUND',
    message: 'Task not found.',
  },
];
