import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { EnvironmentVariables } from './env.schema';
import { ProductionRule, productionRules, Violation } from './production-rules';

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

function toViolations(errors: ValidationError[]): Violation[] {
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

/** Builds a validator running the decorator pass, then `rules` when APP_ENV=production. */
export function validateWith(rules: ProductionRule[]) {
  return (config: Record<string, unknown>): EnvironmentVariables => {
    const env = plainToInstance(EnvironmentVariables, config, {
      exposeDefaultValues: true,
    });
    const errors = validateSync(env, { whitelist: false });
    if (errors.length > 0) {
      throw new ConfigValidationError(toViolations(errors));
    }

    const violations =
      env.APP_ENV === 'production' ? rules.flatMap((rule) => rule(env)) : [];
    if (violations.length > 0) {
      throw new ConfigValidationError(violations);
    }
    return env;
  };
}

export const validate = validateWith(productionRules);
