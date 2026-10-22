import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetTeamSummariesQuery } from '../../../teams/contracts/get-team-summaries.query';
import {
  TeamDirectory,
  TeamSummary,
} from '../../application/ports/team-directory';

/**
 * Task Management's TeamDirectory, answered by Team Management through the QueryBus
 * (GetTeamSummariesQuery from teams/contracts, rule A5). No teams provider or table is used.
 */
@Injectable()
export class QueryBusTeamDirectory extends TeamDirectory {
  constructor(private readonly queryBus: QueryBus) {
    super();
  }

  async summaries(
    ownerId: string,
    ids: readonly string[],
  ): Promise<TeamSummary[]> {
    if (ids.length === 0) return [];
    const teams = await this.queryBus.execute(
      new GetTeamSummariesQuery(ownerId, ids),
    );
    // Our own shape (anti-corruption): extra fields Team Management may add never leak in.
    return teams.map(({ id, name, colorHex }) => ({ id, name, colorHex }));
  }

  async findMissing(
    ownerId: string,
    ids: readonly string[],
  ): Promise<string[]> {
    if (ids.length === 0) return [];
    const live = new Set(
      (await this.summaries(ownerId, ids)).map((team) => team.id.toLowerCase()),
    );
    return ids.filter((id) => !live.has(id.toLowerCase()));
  }
}
