import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TeamNotFound } from '../../domain/errors/team.errors';
import { TeamRepository } from '../../domain/repositories/team.repository';

export interface DeleteTeamInput {
  readonly ownerId: string;
  readonly id: string;
}

/**
 * Load (404, also for a foreign team) → `team.delete` → the repository's single transaction:
 * soft delete, version bump of the linked tasks and removal of the team's task_teams rows. A
 * failure in any step applies none of them (AC-02.7.4, AC-08.4). Last write wins (ADR-0020).
 */
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
