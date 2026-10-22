import { Injectable } from '@nestjs/common';
import { DomainError } from '../../domain/domain-error';

export interface DomainErrorMapping {
  error: abstract new (...args: never[]) => DomainError;
  status: number;
  code: string;
  message: string;
  details?: (error: DomainError) => unknown;
}

@Injectable()
export class DomainErrorMappings {
  private readonly byError = new Map<object, DomainErrorMapping>();

  register(mappings: readonly DomainErrorMapping[]): void {
    for (const mapping of mappings) {
      if (mapping.code.trim() === '' || mapping.message.trim() === '') {
        throw new Error(`${mapping.error.name} needs a fixed code and message`);
      }
      if (this.byError.has(mapping.error)) {
        throw new Error(`${mapping.error.name} is already mapped`);
      }
      this.byError.set(mapping.error, mapping);
    }
  }

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
