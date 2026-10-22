import { Injectable } from '@nestjs/common';
import { TeamLookup } from '../../../teams/team-lookup.service';
import {
  TeamDirectory,
  TeamSummary,
} from '../../application/ports/team-directory';

/**
 * Task Management's TeamDirectory, answered by Team Management's exported TeamLookup
 * (ADR-0020). No other teams provider or table is used.
 */
@Injectable()
export class TeamLookupDirectory extends TeamDirectory {
  constructor(private readonly teams: TeamLookup) {
    super();
  }

  async summaries(
    ownerId: string,
    ids: readonly string[],
  ): Promise<TeamSummary[]> {
    const teams = await this.teams.summaries(ownerId, ids);
    // Our own shape (anti-corruption): extra fields Team Management may add never leak in.
    return teams.map(({ id, name, colorHex }) => ({ id, name, colorHex }));
  }

  findMissing(ownerId: string, ids: readonly string[]): Promise<string[]> {
    return this.teams.findMissing(ownerId, ids);
  }
}
