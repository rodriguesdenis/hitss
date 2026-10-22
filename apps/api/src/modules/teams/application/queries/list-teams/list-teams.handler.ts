import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Page } from '../../../../../shared/application/page';
import { Traced } from '../../../../../shared/observability/tracing/traced-handler';
import { TeamTaskCounts } from '../../ports/team-task-counts';
import { TeamReadModel } from '../../ports/team.read-model';
import type { TeamDetails } from '../../views/team.view';
import { ListTeamsQuery } from './list-teams.query';

/** The page from the read model plus ONE task-count call for its ids (no N+1, plan 002). */
@QueryHandler(ListTeamsQuery)
export class ListTeamsHandler implements IQueryHandler<
  ListTeamsQuery,
  Page<TeamDetails>
> {
  constructor(
    private readonly readModel: TeamReadModel,
    private readonly taskCounts: TeamTaskCounts,
  ) {}

  @Traced()
  async execute({
    ownerId,
    criteria,
  }: ListTeamsQuery): Promise<Page<TeamDetails>> {
    const { items, total } = await this.readModel.page(ownerId, criteria);
    if (items.length === 0) {
      return { items: [], total };
    }
    const counts = await this.taskCounts.countByTeam(
      ownerId,
      items.map((team) => team.id),
    );
    return {
      items: items.map((team) => ({
        ...team,
        taskCount: counts.get(team.id) ?? 0,
      })),
      total,
    };
  }
}
