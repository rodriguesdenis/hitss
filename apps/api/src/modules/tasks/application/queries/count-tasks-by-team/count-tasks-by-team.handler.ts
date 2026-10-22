import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  CountTasksByTeamQuery,
  TaskCountsByTeam,
} from '../../../contracts/count-tasks-by-team.query';
import { TaskReadModel } from '../../ports/task.read-model';

/** Answers Team Management's `taskCount` from one grouped query (T-003-14a's countByTeams). */
@QueryHandler(CountTasksByTeamQuery)
export class CountTasksByTeamHandler implements IQueryHandler<
  CountTasksByTeamQuery,
  TaskCountsByTeam
> {
  constructor(private readonly readModel: TaskReadModel) {}
  execute({
    ownerId,
    teamIds,
  }: CountTasksByTeamQuery): Promise<TaskCountsByTeam> {
    return this.readModel.countByTeams(ownerId, [...new Set(teamIds)]);
  }
}
