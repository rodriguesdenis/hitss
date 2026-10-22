import type { DomainErrorMapping } from '../../../../shared/presentation/filters/domain-error-mappings';
import { ErrorCode } from '../../../../shared/presentation/filters/error-codes';
import {
  InvalidDueDate,
  InvalidTaskDescription,
  InvalidTaskStatus,
  InvalidTaskTitle,
  TaskNotFound,
  TooManyTeams,
  UnknownTeams,
} from '../../domain/errors/task.errors';

const invalid = (
  error:
    | typeof InvalidTaskTitle
    | typeof InvalidTaskDescription
    | typeof InvalidTaskStatus
    | typeof InvalidDueDate,
  field: string,
  message: string,
): DomainErrorMapping => ({
  error,
  status: 400,
  code: ErrorCode.VALIDATION_FAILED,
  message: 'Request validation failed.',
  details: () => [{ field, message }],
});

export const TASK_ERROR_MAPPINGS: readonly DomainErrorMapping[] = [
  invalid(
    InvalidTaskTitle,
    'title',
    'title must be 3 to 120 characters with no control characters',
  ),
  invalid(
    InvalidTaskDescription,
    'description',
    'description must be at most 2000 characters with no control characters other than line breaks',
  ),
  invalid(
    InvalidTaskStatus,
    'status',
    'status must be one of PENDING, IN_PROGRESS, DONE',
  ),
  invalid(
    InvalidDueDate,
    'dueDate',
    'dueDate must be a real calendar date in the form YYYY-MM-DD',
  ),
  {
    error: TaskNotFound,
    status: 404,
    code: 'TASK_NOT_FOUND',
    message: 'Task not found.',
  },
  {
    error: TooManyTeams,
    status: 422,
    code: 'TOO_MANY_TEAMS',
    message: 'A task can have at most 10 teams.',
    details: (error) => {
      const { max, received } = error as TooManyTeams;
      return { max, received };
    },
  },
  {
    error: UnknownTeams,
    status: 422,
    code: 'UNKNOWN_TEAMS',
    message: 'Some teams do not exist.',
    details: (error) => ({ teamIds: [...(error as UnknownTeams).teamIds] }),
  },
];
