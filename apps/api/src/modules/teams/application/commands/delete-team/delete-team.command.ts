/** Soft-delete one of the owner's teams (AC-02.7.x). */
export class DeleteTeamCommand {
  constructor(
    readonly ownerId: string,
    readonly id: string,
  ) {}
}
