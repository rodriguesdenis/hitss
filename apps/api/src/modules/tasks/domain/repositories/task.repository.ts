import { Task } from '../entities/task.entity';

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
   * if the stored row is the owner's and active; `version` is incremented in the same statement
   * (kept as data; last write wins, ADR-0020). Soft-deleting is an update with `deletedAt` set.
   * @throws TaskNotFound when the row is unknown, foreign or already deleted.
   * @throws UnknownTeams (without ids) when a linked team no longer exists; nothing is written.
   */
  abstract update(task: Task): Promise<void>;

  /**
   * Serializes, until the current transaction ends, every writer of links to these teams: task
   * writes that check the teams with TeamDirectory, and the TeamDeleted reaction that unassigns
   * one. Whoever comes second waits for the first to commit, then reads its result, so a team
   * deleted concurrently with a task write never leaves a stale link (T-003-13). Call it inside
   * a unit of work, before checking the teams.
   * @throws Error outside a transaction (the lock would be released at once).
   */
  abstract lockTeamLinks(teamIds: readonly string[]): Promise<void>;
}
