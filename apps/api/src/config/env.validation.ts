import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConfigValidationError, toViolations } from './config-validation-error';
import { EnvironmentVariables } from './env.schema';
import { ProductionRule, productionRules } from './production-rules';

export { ConfigValidationError };

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
