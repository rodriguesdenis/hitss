/** What Task Management needs to know about a team to show it on a task (its chip). */
export interface TeamSummary {
  readonly id: string;
  readonly name: string;
  readonly colorHex: string;
}

/**
 * Task Management's view of Team Management, in its own language (constitution II.2): no
 * import of the teams module. The adapter (T-003-05) sends GetTeamSummariesQuery from
 * teams/contracts on the QueryBus.
 */
export abstract class TeamDirectory {
  /** The owner's live teams among `ids`; deleted, foreign and unknown ids are omitted. */
  abstract summaries(
    ownerId: string,
    ids: readonly string[],
  ): Promise<TeamSummary[]>;

  /** The ids that are not live teams of the owner, in input order. */
  abstract findMissing(
    ownerId: string,
    ids: readonly string[],
  ): Promise<string[]>;
}
