import {
  DomainError,
  InvalidField,
} from '../../../../shared/domain/domain-error';

export class InvalidTeamName extends InvalidField {
  constructor() {
    super('name', 'name must be 2 to 50 characters with no control characters');
  }
}

export class InvalidColorHex extends InvalidField {
  constructor() {
    super('colorHex', 'colorHex must be a #RRGGBB hex color');
  }
}

export class InvalidTeamDescription extends InvalidField {
  constructor() {
    super(
      'description',
      'description must be at most 280 characters with no control characters other than line breaks',
    );
  }
}

export class TeamNotFound extends DomainError {
  readonly code = 'TEAM_NOT_FOUND';
  readonly kind = 'not_found';

  constructor() {
    super('Team not found.');
  }
}

export class TeamNameAlreadyExists extends DomainError {
  readonly code = 'TEAM_NAME_ALREADY_EXISTS';
  readonly kind = 'conflict';

  constructor() {
    super('A team with this name already exists.');
  }
}
