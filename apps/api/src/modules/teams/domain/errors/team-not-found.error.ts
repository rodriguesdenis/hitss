import { DomainError } from '../../../../shared/domain/domain-error';

/** The id is unknown, deleted or owned by another user (never revealed which). */
export class TeamNotFound extends DomainError {
  constructor() {
    super('Team not found.');
  }
}
