import { Team } from '../entities/team.entity';
import { TeamName } from '../value-objects/team-name.vo';

export abstract class TeamRepository {
  abstract findById(ownerId: string, id: string): Promise<Team | null>;

  abstract existsActiveByName(
    ownerId: string,
    name: TeamName,
    excludingId?: string,
  ): Promise<boolean>;

  abstract insert(team: Team): Promise<void>;

  abstract update(team: Team): Promise<void>;

  abstract delete(team: Team): Promise<void>;
}
