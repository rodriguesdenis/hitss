import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { Team } from '../../domain/entities/team.entity';
import { TeamNameAlreadyExists } from '../../domain/errors/team.errors';
import { TeamRepository } from '../../domain/repositories/team.repository';
import { ColorHex } from '../../domain/value-objects/color-hex.vo';
import { TeamName } from '../../domain/value-objects/team-name.vo';
import type { TeamView } from '../interfaces/team-read-model.interface';
import { GetTeamUseCase } from './get-team.use-case';

export interface CreateTeamInput {
  readonly ownerId: string;
  readonly name: string;
  readonly colorHex: string;
  readonly description?: string | null;
}

@Injectable()
export class CreateTeamUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
    private readonly getTeam: GetTeamUseCase,
  ) {}

  async execute(input: CreateTeamInput): Promise<TeamView> {
    const team = Team.create({
      ownerId: input.ownerId,
      name: TeamName.create(input.name),
      color: ColorHex.create(input.colorHex),
      description: input.description,
      now: this.clock.now(),
    });
    if (await this.teams.existsActiveByName(input.ownerId, team.name)) {
      throw new TeamNameAlreadyExists();
    }
    await this.teams.insert(team);
    return this.getTeam.execute({ ownerId: input.ownerId, id: team.id });
  }
}
