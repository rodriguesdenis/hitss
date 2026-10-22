import type { TeamLookup } from '../../../teams/team-lookup.service';
import { UnknownTeams } from '../../domain/errors/task.errors';

/**
 * The repository turns a team-link foreign-key violation into `UnknownTeams` without ids: it
 * never reads Team Management's tables. After the failed write this asks TeamLookup which ids
 * are missing, so `UNKNOWN_TEAMS` lists exactly the offending ids (AC-03.1.6). Any other error,
 * or an `UnknownTeams` that already has ids, is returned unchanged.
 */
export async function preciseUnknownTeams(
  error: unknown,
  teams: Pick<TeamLookup, 'findMissing'>,
  ownerId: string,
  teamIds: readonly string[],
): Promise<unknown> {
  if (!(error instanceof UnknownTeams) || error.teamIds.length > 0) {
    return error;
  }
  const missing = await teams.findMissing(ownerId, teamIds);
  return missing.length > 0 ? new UnknownTeams(missing) : error;
}
