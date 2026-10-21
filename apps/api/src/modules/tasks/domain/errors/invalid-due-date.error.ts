import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidDueDate extends DomainError {
  readonly field = 'dueDate';

  constructor() {
    super('Due date must be a real calendar date in the form YYYY-MM-DD.');
  }
}
