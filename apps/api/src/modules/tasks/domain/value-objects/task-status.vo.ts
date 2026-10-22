import { InvalidTaskStatus } from '../errors/task.errors';

export const TaskStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

const VALUES: readonly unknown[] = Object.values(TaskStatus);

export function isTaskStatus(value: unknown): value is TaskStatus {
  return VALUES.includes(value);
}

export function parseTaskStatus(raw: string): TaskStatus {
  if (!isTaskStatus(raw)) {
    throw new InvalidTaskStatus();
  }
  return raw;
}
