import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTeamSummariesQuery } from '../../../contracts/get-team-summaries.query';
import type { TeamSummary } from '../../../contracts/team-summary';
import { TeamReadModel } from '../../ports/team.read-model';

/** Answers Task Management's GetTeamSummariesQuery from the team read model (no aggregate). */
@QueryHandler(GetTeamSummariesQuery)
export class GetTeamSummariesHandler implements IQueryHandler<
  GetTeamSummariesQuery,
  TeamSummary[]
> {
  constructor(private readonly readModel: TeamReadModel) {}
  execute(query: GetTeamSummariesQuery): Promise<TeamSummary[]> {
    return this.readModel.summaries(query.ownerId, query.ids);
  }
}
