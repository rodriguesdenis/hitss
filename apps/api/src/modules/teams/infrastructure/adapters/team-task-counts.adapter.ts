import { Injectable } from '@nestjs/common';
import { TeamTaskCounts } from '../../application/ports/team-task-counts';

/**
 * Placeholder until Task Management ships CountTasksByTeamQuery (T-003-14): every team counts 0,
 * which is exact for a new team (AC-02.8.3). T-003-14b switches this adapter to the QueryBus.
 */
// replaced by CountTasksByTeamQuery in T-003-14b
@Injectable()
export class ZeroTeamTaskCounts extends TeamTaskCounts {
  countByTeam(
    _ownerId: string,
    teamIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    return Promise.resolve(new Map(teamIds.map((id) => [id, 0])));
  }
}
