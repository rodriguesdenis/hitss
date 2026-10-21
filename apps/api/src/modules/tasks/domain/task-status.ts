/** Lifecycle position of a task; any status may change to any other (BR-03.4). */
export const TaskStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
