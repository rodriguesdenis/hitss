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
