import type { TeamReadModel } from '../../src/modules/teams/application/interfaces/team-read-model.interface';
import {
  TeamLookup,
  TeamSummary,
} from '../../src/modules/teams/team-lookup.service';

interface KnownTeam extends TeamSummary {
  readonly ownerId: string;
  readonly deleted: boolean;
}

export class InMemoryTeamLookup extends TeamLookup {
  private readonly teams = new Map<string, KnownTeam>();

  constructor() {
    super(undefined as unknown as TeamReadModel);
  }

  add(ownerId: string, team: TeamSummary): void {
    this.teams.set(team.id, { ...team, ownerId, deleted: false });
  }

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
