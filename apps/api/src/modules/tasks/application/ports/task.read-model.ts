import type {
  Page,
  PageRequest,
  Sort,
} from '../../../../shared/application/page';
import type { TaskStatus } from '../../domain/value-objects/task-status';

/** A task as the read side stores it: flat, no aggregate, team links as ids. */
export interface TaskRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  /** Calendar day (UTC), `YYYY-MM-DD`. */
  readonly dueDate: string | null;
  readonly completedAt: Date | null;
  /** Sorted ids of the task's team links (team liveness is the TeamDirectory's business). */
  readonly teamIds: readonly string[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** AC-03.6.1: the sortable fields; the default is `-createdAt`, ties are broken by id. */
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
  /** Only tasks linked to this team (the handler first checks the team is live and owned). */
  readonly teamId?: string;
  /** Any of these statuses (distinct, non-empty). */
  readonly statuses?: readonly TaskStatus[];
  /** Already trimmed and non-blank; matched literally in the title or the description. */
  readonly search?: string;
  readonly sort: Sort<TaskSortField>;
}

/**
 * Query side of Task Management (plan 003 "Why a separate read side"): rows straight from SQL,
 * never aggregates. Every method is owner-scoped and sees active tasks only.
 */
export abstract class TaskReadModel {
  /** The owner's active task, or `null` when it is unknown, foreign, malformed or deleted. */
  abstract findById(ownerId: string, id: string): Promise<TaskRecord | null>;

  /**
   * One page of the owner's active tasks matching every filter (AND), in `sort` order with an
   * id tie-break, plus the total number of matches, both from one snapshot. Each record carries
   * all of its team ids, also when filtered by one team.
   */
  abstract list(
    ownerId: string,
    criteria: ListTasksCriteria,
  ): Promise<Page<TaskRecord>>;
}
