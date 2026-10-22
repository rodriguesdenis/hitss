/** Archive one of the owner's tasks (AC-03.11.x). */
export class DeleteTaskCommand {
  constructor(
    readonly ownerId: string,
    readonly id: string,
  ) {}
}
