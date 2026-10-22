import type { TaskStatus } from '../../domain/value-objects/task-status';
import type { TeamSummary } from '../ports/team-directory';

/** The task as every API response shows it (api-contracts "Task resource"). */
export interface TaskView {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly dueDate: string | null;
  readonly completedAt: Date | null;
  readonly isOverdue: boolean;
  /** Live teams only, ordered by name (case-insensitive), ties by id. */
  readonly teams: readonly TeamSummary[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
