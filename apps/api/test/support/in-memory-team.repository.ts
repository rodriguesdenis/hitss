import { ConcurrencyConflict } from '../../src/shared/domain/domain-error';
import { Team, TeamProps } from '../../src/modules/teams/domain/team';
import {
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../src/modules/teams/domain/team.errors';
import { TeamRepository } from '../../src/modules/teams/domain/team.repository';
import { TeamName } from '../../src/modules/teams/domain/value-objects/team-name';

/**
 * In-memory TeamRepository for handler unit tests. It passes the same contract suite as the
 * Prisma adapter (team-repository.contract.ts): snapshots in, fresh aggregates out, the same
 * version guard, owner scoping and errors. Names are compared with TeamName.equals, the domain
 * approximation of the database's lower(name) index.
 */
export class InMemoryTeamRepository extends TeamRepository {
  private readonly rows = new Map<string, TeamProps>();

  /** Stores a team as-is (its own version), bypassing the name check. For test setup. */
  seed(team: Team): void {
    this.rows.set(team.id, snapshot(team, team.version));
  }

  /** Every stored team, deleted ones included, as fresh aggregates. */
  all(): Team[] {
    return [...this.rows.values()].map((row) => Team.reconstitute(row));
  }

  findById(ownerId: string, id: string): Promise<Team | null> {
    const row = this.rows.get(id);
    const visible = row && row.ownerId === ownerId && row.deletedAt === null;
    return Promise.resolve(visible ? Team.reconstitute(row) : null);
  }

  existsActiveByName(
    ownerId: string,
    name: TeamName,
    excludingId?: string,
  ): Promise<boolean> {
    return Promise.resolve(this.nameTaken(ownerId, name, excludingId));
  }

  insert(team: Team): Promise<void> {
    if (this.rows.has(team.id)) {
      return Promise.reject(new Error(`Duplicate team id ${team.id}`));
    }
    if (this.nameTaken(team.ownerId, team.name)) {
      return Promise.reject(new TeamNameAlreadyExists());
    }
    this.rows.set(team.id, snapshot(team, 1));
    return Promise.resolve();
  }

  update(team: Team, expectedVersion: number): Promise<number> {
    const row = this.rows.get(team.id);
    if (!row || row.ownerId !== team.ownerId || row.deletedAt !== null) {
      return Promise.reject(new TeamNotFound());
    }
    if (row.version !== expectedVersion) {
      return Promise.reject(new ConcurrencyConflict(row.version));
    }
    if (
      team.deletedAt === null &&
      this.nameTaken(team.ownerId, team.name, team.id)
    ) {
      return Promise.reject(new TeamNameAlreadyExists());
    }
    const version = expectedVersion + 1;
    this.rows.set(team.id, snapshot(team, version));
    return Promise.resolve(version);
  }

  private nameTaken(
    ownerId: string,
    name: TeamName,
    excludingId?: string,
  ): boolean {
    return [...this.rows.values()].some(
      (row) =>
        row.ownerId === ownerId &&
        row.deletedAt === null &&
        row.id !== excludingId &&
        row.name.equals(name),
    );
  }
}

function snapshot(team: Team, version: number): TeamProps {
  return {
    id: team.id,
    ownerId: team.ownerId,
    name: team.name,
    color: team.color,
    description: team.description,
    version,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    deletedAt: team.deletedAt,
  };
}
