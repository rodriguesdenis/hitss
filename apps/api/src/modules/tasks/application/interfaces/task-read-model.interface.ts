import type {
  Page,
  PageRequest,
  Sort,
} from '../../../../shared/application/page';
import type { TaskStatus } from '../../domain/value-objects/task-status.vo';
import type { TeamSummary } from './team-directory.interface';
import type { DueDate } from '../../domain/value-objects/due-date.vo';

export interface TaskRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly dueDate: string | null;
  readonly completedAt: Date | null;
  readonly teamIds: readonly string[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TaskView {
  readonly task: TaskRecord;
  readonly teams: readonly TeamSummary[];
  readonly today: DueDate;
}

export interface TaskPageView {
  readonly page: Page<TaskRecord>;
  readonly teams: readonly TeamSummary[];
  readonly today: DueDate;
}

export const TASK_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'dueDate',
  'title',
  'status',
] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export interface ListTasksCriteria {
  readonly page: PageRequest;
  readonly teamId?: string;
  readonly statuses?: readonly TaskStatus[];
  readonly search?: string;
  readonly sort: Sort<TaskSortField>;
}

export abstract class TaskReadModel {
  abstract findById(ownerId: string, id: string): Promise<TaskRecord | null>;

  abstract list(
    ownerId: string,
    criteria: ListTasksCriteria,
  ): Promise<Page<TaskRecord>>;
}
