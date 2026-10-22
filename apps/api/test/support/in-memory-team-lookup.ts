import type { TeamReadModel } from '../../src/modules/teams/application/ports/team.read-model';
import {
  TeamLookup,
  TeamSummary,
} from '../../src/modules/teams/team-lookup.service';

interface KnownTeam extends TeamSummary {
  readonly ownerId: string;
  readonly deleted: boolean;
}

/**
 * In-memory TeamLookup for Task Management's use-case tests. Same semantics as the real one:
 * only the owner's live teams are summarised or found; deleted, foreign, unknown and malformed
 * ids are missing.
 */
export class InMemoryTeamLookup extends TeamLookup {
  private readonly teams = new Map<string, KnownTeam>();

  constructor() {
    // Every public method is overridden below; the read model is never reached.
    super(undefined as unknown as TeamReadModel);
  }

  /** Registers a live team of `ownerId`. */
  add(ownerId: string, team: TeamSummary): void {
    this.teams.set(team.id, { ...team, ownerId, deleted: false });
  }

  /** Marks a known team as soft-deleted (it stops being live). */
  remove(teamId: string): void {
    const team = this.teams.get(teamId);
    if (team) this.teams.set(teamId, { ...team, deleted: true });
  }

  override summaries(
    ownerId: string,
    ids: readonly string[],
  ): Promise<TeamSummary[]> {
    const live = ids
      .map((id) => this.live(ownerId, id))
      .filter((team): team is KnownTeam => team !== undefined)
      .map(({ id, name, colorHex }) => ({ id, name, colorHex }));
    return Promise.resolve(live);
  }

  override findMissing(
    ownerId: string,
    ids: readonly string[],
  ): Promise<string[]> {
    return Promise.resolve(ids.filter((id) => !this.live(ownerId, id)));
  }

  private live(ownerId: string, id: string): KnownTeam | undefined {
    const team = this.teams.get(id);
    return team && team.ownerId === ownerId && !team.deleted ? team : undefined;
  }
}
