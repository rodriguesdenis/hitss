import {
  Team,
  TeamProps,
} from '../../src/modules/teams/domain/entities/team.entity';
import {
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../src/modules/teams/domain/errors/team.errors';
import { TeamRepository } from '../../src/modules/teams/domain/repositories/team.repository';
import { TeamName } from '../../src/modules/teams/domain/value-objects/team-name.vo';

export class InMemoryTeamRepository extends TeamRepository {
  private readonly rows = new Map<string, TeamProps>();

  seed(team: Team): void {
    this.rows.set(team.id, snapshot(team, team.version));
  }

  all(): Team[] {
    return [...this.rows.values()].map((row) => Team.restore(row));
  }

  findById(ownerId: string, id: string): Promise<Team | null> {
    const row = this.rows.get(id);
    const visible = row && row.ownerId === ownerId && row.deletedAt === null;
    return Promise.resolve(visible ? Team.restore(row) : null);
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

  delete(team: Team): Promise<void> {
    return this.update(team);
  }

  update(team: Team): Promise<void> {
    const row = this.rows.get(team.id);
    if (!row || row.ownerId !== team.ownerId || row.deletedAt !== null) {
      return Promise.reject(new TeamNotFound());
    }
    if (
      team.deletedAt === null &&
      this.nameTaken(team.ownerId, team.name, team.id)
    ) {
      return Promise.reject(new TeamNameAlreadyExists());
    }
    const version = row.version + 1;
    this.rows.set(team.id, snapshot(team, version));
    return Promise.resolve();
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
