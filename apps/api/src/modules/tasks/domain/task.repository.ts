import { Task } from './task';

/**
 * Persistence port of the Task aggregate (ADR-0002, decision P-2): loads and saves whole
 * aggregates, team links included, using domain types only. An `abstract class` so it is
 * directly a Nest DI token; the Prisma adapter lives in `infrastructure/`.
 *
 * Every method takes `ownerId` first or reads it from the aggregate, and scopes by it (BOLA): a
 * foreign task behaves exactly like an unknown one.
 */
export abstract class TaskRepository {
  /** The owner's active task with its team ids, or `null` when unknown, foreign or deleted. */
  abstract findById(ownerId: string, id: string): Promise<Task | null>;

  /** The owner's active tasks assigned to `teamId`, ordered by id (OnTeamDeleted reaction). */
  abstract findByTeam(ownerId: string, teamId: string): Promise<Task[]>;

  /**
   * Stores a new task at version 1 together with its team links, atomically.
   * @throws UnknownTeams (without ids) when a linked team no longer exists; nothing is stored.
   *   The caller asks TeamDirectory.findMissing for the precise ids.
   */
  abstract insert(task: Task): Promise<void>;

  /**
   * Writes the task's current state and replaces its team links with `task.teamIds`, atomically,
   * only if the stored row is active and still at `expectedVersion`; the version is incremented
   * in the same statement (ADR-0015, V-1: the aggregate never changes it). Soft-deleting is an
   * update with `deletedAt` set.
   * @returns the new version (`expectedVersion + 1`).
   * @throws TaskNotFound when the row is unknown, foreign or already deleted.
   * @throws ConcurrencyConflict with the current version when it differs from `expectedVersion`.
   * @throws UnknownTeams (without ids) when a linked team no longer exists; nothing is written.
   */
  abstract update(task: Task, expectedVersion: number): Promise<number>;
}
