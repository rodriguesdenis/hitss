/**
 * A team as the read side returns it, for lists and for a single team (GetTeam reads back the
 * same view). The handler adds `taskCount` from TeamTaskCounts; the presenter serializes dates.
 */
export interface TeamView {
  readonly id: string;
  readonly name: string;
  readonly colorHex: string;
  readonly description: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A single team as the API returns it: the view plus its active-task count (TeamTaskCounts). */
export type TeamDetails = TeamView & { readonly taskCount: number };
