import { Injectable } from '@nestjs/common';
import {
  TeamReadModel,
  TeamSummary,
} from './application/interfaces/team-read-model.interface';

export type { TeamSummary };

@Injectable()
export class TeamLookup {
  constructor(private readonly readModel: TeamReadModel) {}

  async summaries(
    ownerId: string,
    ids: readonly string[],
  ): Promise<TeamSummary[]> {
    if (ids.length === 0) return [];
    return this.readModel.summaries(ownerId, ids);
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
}
