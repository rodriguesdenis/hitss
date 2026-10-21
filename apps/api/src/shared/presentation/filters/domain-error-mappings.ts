import { Injectable } from '@nestjs/common';
import { DomainError } from '../../domain/domain-error';

/** How a module's domain error becomes an HTTP error. */
export interface DomainErrorMapping {
  error: abstract new (...args: never[]) => DomainError;
  status: number;
  code: string;
  details?: (error: DomainError) => unknown;
}

/**
 * Registry the exception filter reads. Each bounded-context module registers its own table
 * from `onModuleInit` (e.g. `TEAM_ERROR_MAPPINGS`), so the shared layer never imports modules.
 */
@Injectable()
export class DomainErrorMappings {
  private readonly byError = new Map<object, DomainErrorMapping>();

  /** Fails at boot when a class is mapped twice: two modules must not disagree on one error. */
  register(mappings: readonly DomainErrorMapping[]): void {
    for (const mapping of mappings) {
      if (this.byError.has(mapping.error)) {
        throw new Error(`${mapping.error.name} is already mapped`);
      }
      this.byError.set(mapping.error, mapping);
    }
  }

  /** The mapping of the error's class, or of its closest mapped ancestor. */
  find(error: unknown): DomainErrorMapping | undefined {
    if (!(error instanceof DomainError)) {
      return undefined;
    }
    for (
      let prototype: object | null = Object.getPrototypeOf(error) as object;
      prototype !== null && prototype !== Object.prototype;
      prototype = Object.getPrototypeOf(prototype) as object | null
    ) {
      const mapping = this.byError.get(prototype.constructor);
      if (mapping) {
        return mapping;
      }
    }
    return undefined;
  }

  all(): readonly DomainErrorMapping[] {
    return [...this.byError.values()];
  }
}
