import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidTaskStatus extends DomainError {
  readonly field = 'status';

  constructor() {
    super('Status must be one of PENDING, IN_PROGRESS or DONE.');
  }
}
