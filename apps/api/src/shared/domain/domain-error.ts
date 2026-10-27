export type DomainErrorKind = 'validation' | 'not_found' | 'conflict' | 'rule';

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKind;
  readonly details?: unknown;

  protected constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export abstract class InvalidField extends DomainError {
  readonly code = 'VALIDATION_FAILED';
  readonly kind = 'validation';

  protected constructor(
    readonly field: string,
    rule: string,
  ) {
    super('Request validation failed.', [{ field, message: rule }]);
  }
}
