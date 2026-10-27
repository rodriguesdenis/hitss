export interface TeamSummary {
  readonly id: string;
  readonly name: string;
  readonly colorHex: string;
}

export abstract class TeamDirectory {
  abstract summaries(
    ownerId: string,
    ids: readonly string[],
  ): Promise<TeamSummary[]>;

  abstract findMissing(
    ownerId: string,
    ids: readonly string[],
  ): Promise<string[]>;

  abstract assertAllLive(
    ownerId: string,
    ids: readonly string[],
    toError: (missing: string[]) => Error,
  ): Promise<void>;
}
