import {
  TeamDirectory,
  TeamSummary,
} from '../../src/modules/tasks/application/ports/team-directory';

interface KnownTeam extends TeamSummary {
  readonly ownerId: string;
  readonly deleted: boolean;
}

/**
 * In-memory TeamDirectory for Task Management tests, until the QueryBus adapter (T-003-05)
 * exists. Same semantics as the port: only the owner's live teams are summarised or found;
 * deleted, foreign, unknown and malformed ids are missing.
 */
export class InMemoryTeamDirectory extends TeamDirectory {
  private readonly teams = new Map<string, KnownTeam>();

  /** Registers a live team of `ownerId`. */
  add(ownerId: string, team: TeamSummary): void {
    this.teams.set(team.id, { ...team, ownerId, deleted: false });
  }

  /** Marks a known team as soft-deleted (it stops being live). */
  remove(teamId: string): void {
    const team = this.teams.get(teamId);
    if (team) this.teams.set(teamId, { ...team, deleted: true });
  }

  summaries(ownerId: string, ids: readonly string[]): Promise<TeamSummary[]> {
    const live = ids
      .map((id) => this.live(ownerId, id))
      .filter((team): team is KnownTeam => team !== undefined)
      .map(({ id, name, colorHex }) => ({ id, name, colorHex }));
    return Promise.resolve(live);
  }

  findMissing(ownerId: string, ids: readonly string[]): Promise<string[]> {
    return Promise.resolve(ids.filter((id) => !this.live(ownerId, id)));
  }

  private live(ownerId: string, id: string): KnownTeam | undefined {
    const team = this.teams.get(id);
    return team && team.ownerId === ownerId && !team.deleted ? team : undefined;
  }
}
