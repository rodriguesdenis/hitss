import { DomainEvent } from '../../../../shared/domain/domain-event';
import { TaskStatus } from '../task-status';

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
