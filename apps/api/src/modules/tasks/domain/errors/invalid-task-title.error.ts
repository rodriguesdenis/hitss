import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidTaskTitle extends DomainError {
  readonly field = 'title';

  constructor() {
    super(
      'Title must be 3 to 120 characters long and contain no control characters.',
    );
  }
}
