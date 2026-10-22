import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { CountTasksByTeamQuery } from '../../../tasks/contracts/count-tasks-by-team.query';
import { TeamTaskCounts } from '../../application/ports/team-task-counts';

/**
 * Team Management's view of task counts, answered by Task Management through the QueryBus
 * (`CountTasksByTeamQuery` from tasks/contracts, rule A5): one query per page, distinct ids, and
 * every requested id in the result (0 when Task Management has none for it).
 */
@Injectable()
export class QueryBusTeamTaskCounts extends TeamTaskCounts {
  constructor(private readonly queryBus: QueryBus) {
    super();
  }

  async countByTeam(
    ownerId: string,
    teamIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    const ids = [...new Set(teamIds)];
    if (ids.length === 0) {
      return new Map();
    }
    const counts = await this.queryBus.execute(
      new CountTasksByTeamQuery(ownerId, ids),
    );
    return new Map(ids.map((id) => [id, counts.get(id) ?? 0]));
  }
}
