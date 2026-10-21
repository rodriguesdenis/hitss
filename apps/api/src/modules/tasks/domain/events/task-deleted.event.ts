import { DomainEvent } from '../../../../shared/domain/domain-event';

/** Raised by `Task.delete`. */
export class TaskDeleted extends DomainEvent {
  constructor(
    readonly taskId: string,
    occurredAt: Date,
  ) {
    super(occurredAt);
  }
}
