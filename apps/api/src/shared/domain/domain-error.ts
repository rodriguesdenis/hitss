/**
 * Base class for errors raised by the domain and application layers.
 * The presentation layer maps each concrete class to an HTTP error code.
 */
export abstract class DomainError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The expected version (`If-Match`) does not match the current one (ADR-0015). */
export class ConcurrencyConflict extends DomainError {
  constructor(readonly currentVersion: number) {
    super(`The resource was modified (current version ${currentVersion}).`);
  }
}
