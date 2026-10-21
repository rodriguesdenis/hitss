import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidTeamDescription extends DomainError {
  readonly field = 'description';

  constructor() {
    super('Description must be at most 280 characters long.');
  }
}
