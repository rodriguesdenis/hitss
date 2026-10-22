import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TeamNotFound } from '../../domain/errors/team.errors';
import { TeamRepository } from '../../domain/repositories/team.repository';

export interface DeleteTeamInput {
  readonly ownerId: string;
  readonly id: string;
}

@Injectable()
export class DeleteTeamUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly clock: Clock,
  ) {}

  async execute({ ownerId, id }: DeleteTeamInput): Promise<void> {
    const team = await this.teams.findById(ownerId, id);
    if (!team) {
      throw new TeamNotFound();
    }
    team.delete(this.clock.now());
    await this.teams.delete(team);
  }
}
