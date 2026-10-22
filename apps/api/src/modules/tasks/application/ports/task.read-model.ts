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

/**
 * Query side of Task Management (plan 003 "Why a separate read side"): rows straight from SQL,
 * never aggregates. Every method is owner-scoped and sees active tasks only. Listing and
 * counting arrive with T-003-09 and T-003-14.
 */
export abstract class TaskReadModel {
  /** The owner's active task, or `null` when it is unknown, foreign, malformed or deleted. */
  abstract findById(ownerId: string, id: string): Promise<TaskRecord | null>;
}
