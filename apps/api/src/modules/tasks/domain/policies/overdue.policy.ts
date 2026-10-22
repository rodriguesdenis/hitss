import { DueDate } from '../value-objects/due-date.vo';
import { TaskStatus } from '../value-objects/task-status.vo';

/**
 * A task is overdue when it has a due date before today (UTC) and is not
 * Done (BR-03.9). Derived on every read, never stored.
 */
export function isOverdue(
  status: TaskStatus,
  dueDate: DueDate | null,
  today: DueDate,
): boolean {
  return (
    status !== TaskStatus.DONE && dueDate !== null && dueDate.isBefore(today)
  );
}
