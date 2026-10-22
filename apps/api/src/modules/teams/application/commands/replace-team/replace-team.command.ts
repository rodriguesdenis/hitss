/** Full replacement of one of the owner's teams (AC-02.6.x); last write wins (ADR-0020). */
export class ReplaceTeamCommand {
  constructor(
    readonly ownerId: string,
    readonly id: string,
    readonly name: string,
    readonly colorHex: string,
    readonly description: string | null | undefined,
  ) {}
}
