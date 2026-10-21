import { DomainError } from '../../../../shared/domain/domain-error';

/** The id is unknown, deleted or owned by another user (never revealed which). */
export class TaskNotFound extends DomainError {
  constructor() {
    super('Task not found.');
  }
}
