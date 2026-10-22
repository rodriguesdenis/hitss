/** One of the owner's active teams, with its task count. */
export class GetTeamQuery {
  constructor(
    readonly ownerId: string,
    readonly id: string,
  ) {}
}
