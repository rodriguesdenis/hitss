import type { TaskStatus } from '../../../domain/value-objects/task-status.vo';

/** Move one of the owner's tasks to `status` (AC-03.10.x). */
export class ChangeTaskStatusCommand {
  constructor(
    readonly ownerId: string,
    readonly id: string,
    readonly status: TaskStatus,
  ) {}
}
