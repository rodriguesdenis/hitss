import { DomainEvent } from '../../../shared/domain/domain-event';
import { TaskStatus } from './value-objects/task-status';

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

/** Raised by `Task.changeStatus` on a real transition (never on a no-op). */
export class TaskStatusChanged extends DomainEvent {
  constructor(
    readonly taskId: string,
    readonly from: TaskStatus,
    readonly to: TaskStatus,
    occurredAt: Date,
  ) {
    super(occurredAt);
  }
}

/** Raised by `Task.delete`. */
export class TaskDeleted extends DomainEvent {
  constructor(
    readonly taskId: string,
    occurredAt: Date,
  ) {
    super(occurredAt);
  }
}
