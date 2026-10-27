import type {
  TeamDirectory,
  TeamSummary,
} from '../../src/modules/tasks/application/interfaces/team-directory.interface';

interface KnownTeam extends TeamSummary {
  readonly ownerId: string;
  readonly deleted: boolean;
}

export class InMemoryTeamDirectory implements TeamDirectory {
  private readonly teams = new Map<string, KnownTeam>();

  add(ownerId: string, team: TeamSummary): void {
    this.teams.set(team.id, { ...team, ownerId, deleted: false });
  }

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

  async assertAllLive(
    ownerId: string,
    ids: readonly string[],
    toError: (missing: string[]) => Error,
  ): Promise<void> {
    const missing = await this.findMissing(ownerId, ids);
    if (missing.length > 0) {
      throw toError(missing);
    }
  }

  private live(ownerId: string, id: string): KnownTeam | undefined {
    const team = this.teams.get(id);
    return team && team.ownerId === ownerId && !team.deleted ? team : undefined;
  }
}
