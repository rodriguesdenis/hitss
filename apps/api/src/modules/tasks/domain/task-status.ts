import { InvalidTaskStatus } from './errors/invalid-task-status.error';

/** Lifecycle position of a task; any status may change to any other (BR-03.4). */
export const TaskStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

const VALUES: readonly unknown[] = Object.values(TaskStatus);

/** Exact, case-sensitive match against the three contract values. */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return VALUES.includes(value);
}

export function parseTaskStatus(raw: string): TaskStatus {
  if (!isTaskStatus(raw)) {
    throw new InvalidTaskStatus();
  }
  return raw;
}
