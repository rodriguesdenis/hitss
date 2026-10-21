import { DomainEvent } from '../../../../shared/domain/domain-event';
import { TaskStatus } from '../task-status';

/** Raised by `Task.create`; a task created as DONE also counts as completed. */
export class TaskCreated extends DomainEvent {
  constructor(
    readonly taskId: string,
    readonly ownerId: string,
    readonly status: TaskStatus,
    occurredAt: Date,
  ) {
    super(occurredAt);
  }
}
