import type { ListTeamsCriteria } from '../../ports/team.read-model';

/** One page of the owner's active teams (AC-02.2.x, AC-02.3.x, AC-02.4.x). */
export class ListTeamsQuery {
  constructor(
    readonly ownerId: string,
    readonly criteria: ListTeamsCriteria,
  ) {}
}
