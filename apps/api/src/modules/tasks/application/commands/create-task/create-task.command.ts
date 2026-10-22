import type { TaskStatus } from '../../../domain/value-objects/task-status';

/** Create a task for the signed-in owner (AC-03.1.x). Values are the DTO's, already trimmed. */
export class CreateTaskCommand {
  constructor(
    readonly ownerId: string,
    readonly title: string,
    readonly description?: string | null,
    readonly status?: TaskStatus,
    readonly dueDate?: string | null,
    readonly teamIds: readonly string[] = [],
  ) {}
}
