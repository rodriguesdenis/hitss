import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { Team } from '../../domain/entities/team.entity';
import { TeamNameAlreadyExists } from '../../domain/errors/team.errors';
import { TeamRepository } from '../../domain/repositories/team.repository';
import { ColorHex } from '../../domain/value-objects/color-hex.vo';
import { TeamName } from '../../domain/value-objects/team-name.vo';

export interface CreateTeamInput {
  readonly ownerId: string;
  readonly name: string;
  readonly colorHex: string;
  readonly description?: string | null;
}

/**
 * Builds the value objects (the domain re-validates what the DTO checked), rejects a name the
 * owner already uses on an active team, and inserts the team at version 1. Returns the new id;
 * the controller reads the team back through GetTeamUseCase.
 */
@Injectable()
export class CreateTeamUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateTeamInput): Promise<string> {
    const team = Team.create({
      ownerId: input.ownerId,
      name: TeamName.create(input.name),
      color: ColorHex.create(input.colorHex),
      description: input.description,
      now: this.clock.now(),
    });
    // Fast path for the common case; the unique index settles races in insert (AC-02.1.9).
    if (await this.teams.existsActiveByName(input.ownerId, team.name)) {
      throw new TeamNameAlreadyExists();
    }
    await this.teams.insert(team);
    return team.id;
  }
}
