/** One of the owner's active tasks, as its task view. */
export class GetTaskQuery {
  constructor(
    readonly ownerId: string,
    readonly id: string,
  ) {}
}
