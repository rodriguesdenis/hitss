import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidTeamName extends DomainError {
  readonly field = 'name';

  constructor() {
    super(
      'Team name must be 2 to 50 characters long and contain no control characters.',
    );
  }
}
