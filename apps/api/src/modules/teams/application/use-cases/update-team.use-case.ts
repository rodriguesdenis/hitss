import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import {
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../domain/errors/team.errors';
import { TeamRepository } from '../../domain/repositories/team.repository';
import { ColorHex } from '../../domain/value-objects/color-hex.vo';
import { TeamName } from '../../domain/value-objects/team-name.vo';

export interface UpdateTeamInput {
  readonly ownerId: string;
  readonly id: string;
  readonly name: string;
  readonly colorHex: string;
  readonly description?: string | null;
}

@Injectable()
export class UpdateTeamUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateTeamInput): Promise<void> {
    const team = await this.teams.findById(input.ownerId, input.id);
    if (!team) {
      throw new TeamNotFound();
    }
    const changed = team.replace({
      name: TeamName.create(input.name),
      color: ColorHex.create(input.colorHex),
      description: input.description,
      now: this.clock.now(),
    });
    if (!changed) {
      return;
    }
    if (
      await this.teams.existsActiveByName(input.ownerId, team.name, input.id)
    ) {
      throw new TeamNameAlreadyExists();
    }
    await this.teams.update(team);
  }
}
