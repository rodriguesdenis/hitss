import type { ListTasksCriteria } from '../../ports/task.read-model';

/** A page of the owner's active tasks matching every filter, as task views. */
export class ListTasksQuery {
  constructor(
    readonly ownerId: string,
    readonly criteria: ListTasksCriteria,
  ) {}
}
