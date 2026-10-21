import { DomainError } from '../../../shared/domain/domain-error';

export class InvalidTeamName extends DomainError {
  readonly field = 'name';

  constructor() {
    super(
      'Team name must be 2 to 50 characters long and contain no control characters.',
    );
  }
}

export class InvalidColorHex extends DomainError {
  readonly field = 'colorHex';

  constructor() {
    super('Color must be a hex color in the form #RRGGBB.');
  }
}

export class InvalidTeamDescription extends DomainError {
  readonly field = 'description';

  constructor() {
    super(
      'Description must be at most 280 characters long and contain no control characters other than line breaks.',
    );
  }
}

/** The id is unknown, deleted or owned by another user (never revealed which). */
export class TeamNotFound extends DomainError {
  constructor() {
    super('Team not found.');
  }
}

/** The owner already has an active team with this name (case-insensitive). */
export class TeamNameAlreadyExists extends DomainError {
  constructor() {
    super('A team with this name already exists.');
  }
}
