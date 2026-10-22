import { Query } from '@nestjs/cqrs';
import type { TeamSummary } from './team-summary';

/**
 * Public query of Team Management (contracts/, rule A5): the owner's live teams among `ids`.
 * Deleted, foreign, unknown and malformed ids are omitted; no order is promised. Task Management
 * sends it on the QueryBus through its TeamDirectory adapter, never importing teams internals.
 */
export class GetTeamSummariesQuery extends Query<TeamSummary[]> {
  constructor(
    readonly ownerId: string,
    readonly ids: readonly string[],
  ) {
    super();
  }
}
