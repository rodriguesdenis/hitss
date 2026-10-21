import { DomainError } from '../../../../shared/domain/domain-error';

export class InvalidColorHex extends DomainError {
  readonly field = 'colorHex';

  constructor() {
    super('Color must be a hex color in the form #RRGGBB.');
  }
}
