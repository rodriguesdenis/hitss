import { ValidationError } from 'class-validator';

export interface Violation {
  variable: string;
  message: string;
}

/** Names every offending variable and the rule broken; never contains a value (secrets). */
export class ConfigValidationError extends Error {
  constructor(readonly violations: Violation[]) {
    super(
      `Invalid configuration:\n${violations
        .map((v) => `  - ${v.variable}: ${v.message}`)
        .join('\n')}`,
    );
    this.name = 'ConfigValidationError';
  }
}

export function toViolations(errors: ValidationError[]): Violation[] {
  return errors.flatMap((error) => {
    const messages = Object.values(error.constraints ?? {});
    return [
      {
        variable: error.property,
        message: messages.join('; ') || 'is invalid',
      },
    ];
  });
}
