import { Traced } from '../../../../../shared/observability/tracing/traced-handler';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TeamNotFound } from '../../../domain/team.errors';
import { TeamTaskCounts } from '../../ports/team-task-counts';
import { TeamReadModel } from '../../ports/team.read-model';
import type { TeamDetails } from '../../views/team.view';
import { GetTeamQuery } from './get-team.query';

/** Reads the team from the read model and adds its active-task count (plan 002 → GetTeam). */
@QueryHandler(GetTeamQuery)
export class GetTeamHandler implements IQueryHandler<
  GetTeamQuery,
  TeamDetails
> {
  constructor(
    private readonly readModel: TeamReadModel,
    private readonly taskCounts: TeamTaskCounts,
  ) {}

  @Traced()
  async execute({ ownerId, id }: GetTeamQuery): Promise<TeamDetails> {
    const view = await this.readModel.findById(ownerId, id);
    if (!view) {
      throw new TeamNotFound();
    }
    const counts = await this.taskCounts.countByTeam(ownerId, [view.id]);
    return { ...view, taskCount: counts.get(view.id) ?? 0 };
  }
}
