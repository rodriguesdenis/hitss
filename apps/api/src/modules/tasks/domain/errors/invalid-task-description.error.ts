import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidTaskDescription extends DomainError {
  readonly field = 'description';

  constructor() {
    super(
      'Description must be at most 2000 characters long and contain no control characters other than line breaks.',
    );
  }
}
