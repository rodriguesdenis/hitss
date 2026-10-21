import { Team } from './team';
import { TeamName } from './value-objects/team-name';

/**
 * Persistence port of the Team aggregate (ADR-0002, decision P-2): loads and saves whole
 * aggregates, using domain types only. An `abstract class` so it is directly a Nest DI token;
 * the Prisma adapter lives in `infrastructure/`.
 *
 * Every method takes `ownerId` first and scopes by it (BOLA): a foreign team behaves exactly
 * like an unknown one.
 */
export abstract class TeamRepository {
  /** The owner's active team, or `null` when it is unknown, foreign or soft-deleted. */
  abstract findById(ownerId: string, id: string): Promise<Team | null>;

  /**
   * Whether the owner has another active team with this name, compared like the database's
   * unique index (`lower(name)`). `excludingId` skips the team being replaced (AC-02.6.5).
   * A fast path only: the index stays authoritative, see `insert` and `update`.
   */
  abstract existsActiveByName(
    ownerId: string,
    name: TeamName,
    excludingId?: string,
  ): Promise<boolean>;

  /**
   * Stores a new team at version 1.
   * @throws TeamNameAlreadyExists when an active team of the owner has the same name
   *   (the unique index also settles concurrent creates, AC-02.1.9).
   */
  abstract insert(team: Team): Promise<void>;

  /**
   * Writes the team's current state (name, color, description, updatedAt, deletedAt) only if
   * the stored row is active and still at `expectedVersion`, incrementing the version in the
   * same statement (ADR-0015, V-1: the aggregate never changes its version). Soft-deleting is
   * an update with `deletedAt` set.
   * @returns the new version (`expectedVersion + 1`).
   * @throws TeamNotFound when the row is unknown, foreign or already deleted.
   * @throws ConcurrencyConflict with the current version when it differs from `expectedVersion`.
   * @throws TeamNameAlreadyExists when a rename collides with another active team.
   */
  abstract update(team: Team, expectedVersion: number): Promise<number>;
}
