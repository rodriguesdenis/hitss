import { Injectable } from '@nestjs/common';
import {
  TeamReadModel,
  TeamSummary,
} from './application/ports/team.read-model';

export type { TeamSummary };

/**
 * The one door other modules use to reach Team Management (ADR-0020): `TeamsModule` exports it
 * and `TasksModule` injects it. Owner-scoped, live teams only.
 */
@Injectable()
export class TeamLookup {
  constructor(private readonly readModel: TeamReadModel) {}

  /** The owner's live teams among `ids`; deleted, foreign, unknown and malformed ids are omitted. */
  async summaries(
    ownerId: string,
    ids: readonly string[],
  ): Promise<TeamSummary[]> {
    if (ids.length === 0) return [];
    return this.readModel.summaries(ownerId, ids);
  }

  /** The ids that are not live teams of the owner, in input order (letter case ignored). */
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
