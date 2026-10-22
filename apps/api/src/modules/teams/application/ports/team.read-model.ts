import type {
  Page,
  PageRequest,
  Sort,
} from '../../../../shared/application/page';
import type { TeamSummary } from '../../contracts/team-summary';
import type { TeamView } from '../views/team.view';

/** BR-02.10: the sortable fields; the default is `-createdAt`, ties are broken by id. */
export const TEAM_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'] as const;
export type TeamSortField = (typeof TEAM_SORT_FIELDS)[number];

export interface ListTeamsCriteria {
  readonly page: PageRequest;
  /** Already trimmed and non-blank (validated by the DTO); matched as a literal substring. */
  readonly search?: string;
  readonly sort: Sort<TeamSortField>;
}

/**
 * Query side of Team Management (CQRS): views straight from SQL, never aggregates. Owner-scoped
 * and active teams only.
 */
export abstract class TeamReadModel {
  /** The owner's active team, or `null` when it is unknown, foreign or soft-deleted. */
  abstract findById(ownerId: string, id: string): Promise<TeamView | null>;

  /**
   * One page of the owner's active teams, in `sort` order with an id tie-break, plus the total
   * number of matches. The page and the total come from the same snapshot.
   */
  abstract page(
    ownerId: string,
    criteria: ListTeamsCriteria,
  ): Promise<Page<TeamView>>;

  /**
   * The owner's live teams among `ids` (GetTeamSummariesQuery). Deleted, foreign, unknown and
   * malformed ids are omitted, duplicates appear once, and no order is promised.
   */
  abstract summaries(
    ownerId: string,
    ids: readonly string[],
  ): Promise<TeamSummary[]>;
}
