import type {
  Page,
  PageRequest,
  Sort,
} from '../../../../shared/application/page';

export const TEAM_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'] as const;
export type TeamSortField = (typeof TEAM_SORT_FIELDS)[number];

export interface ListTeamsCriteria {
  readonly page: PageRequest;
  readonly search?: string;
  readonly sort: Sort<TeamSortField>;
}

export interface TeamView {
  readonly id: string;
  readonly name: string;
  readonly colorHex: string;
  readonly description: string | null;
  readonly taskCount: number;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TeamSummary {
  readonly id: string;
  readonly name: string;
  readonly colorHex: string;
}

export abstract class TeamReadModel {
  abstract findById(ownerId: string, id: string): Promise<TeamView | null>;

  abstract page(
    ownerId: string,
    criteria: ListTeamsCriteria,
  ): Promise<Page<TeamView>>;

  abstract summaries(
    ownerId: string,
    ids: readonly string[],
  ): Promise<TeamSummary[]>;
}
