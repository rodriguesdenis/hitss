import { DomainError } from '../../../../shared/domain/domain-error';

/** The owner already has an active team with this name (case-insensitive). */
export class TeamNameAlreadyExists extends DomainError {
  constructor() {
    super('A team with this name already exists.');
  }
}
