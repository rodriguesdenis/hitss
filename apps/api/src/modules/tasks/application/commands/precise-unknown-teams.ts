import { UnknownTeams } from '../../domain/task.errors';
import type { TeamDirectory } from '../ports/team-directory';

/**
 * The repository turns a team-link foreign-key violation into `UnknownTeams` without ids: it
 * never reads Team Management's tables. Once the unit of work has rolled back, this asks the
 * TeamDirectory (its own connection, so the failed transaction does not matter) which ids are
 * missing, so `UNKNOWN_TEAMS` lists exactly the offending ids (AC-03.1.6). Any other error, or an
 * `UnknownTeams` that already has ids, is returned unchanged.
 */
export async function preciseUnknownTeams(
  error: unknown,
  teams: TeamDirectory,
  ownerId: string,
  teamIds: readonly string[],
): Promise<unknown> {
  if (!(error instanceof UnknownTeams) || error.teamIds.length > 0) {
    return error;
  }
  const missing = await teams.findMissing(ownerId, teamIds);
  return missing.length > 0 ? new UnknownTeams(missing) : error;
}
