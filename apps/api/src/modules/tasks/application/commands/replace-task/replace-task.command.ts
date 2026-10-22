import type { TaskStatus } from '../../../domain/value-objects/task-status.vo';

/**
 * Replace one of the owner's tasks (AC-03.9.x). Values are the DTO's, already trimmed; an
 * omitted description or due date arrives as `undefined` and is cleared.
 */
export class ReplaceTaskCommand {
  constructor(
    readonly ownerId: string,
    readonly id: string,
    readonly title: string,
    readonly status: TaskStatus,
    readonly teamIds: readonly string[],
    readonly description?: string | null,
    readonly dueDate?: string | null,
  ) {}
}
