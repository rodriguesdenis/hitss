/** Create a team for the signed-in owner (AC-02.1.x). Values are the DTO's, already trimmed. */
export class CreateTeamCommand {
  constructor(
    readonly ownerId: string,
    readonly name: string,
    readonly colorHex: string,
    readonly description?: string | null,
  ) {}
}
