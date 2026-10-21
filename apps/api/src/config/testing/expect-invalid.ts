import { ConfigValidationError } from '../env.validation';

/** Valid local configuration; tests override single variables on top of it. */
export const VALID_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  BETTER_AUTH_SECRET: 'unit-test-secret-0123456789abcdef0123456789',
};

type Validate = (config: Record<string, unknown>) => unknown;

/**
 * Asserts that `env` (merged over VALID_ENV) is rejected, that the error names `variable`
 * and that no configured value is echoed in the message.
 */
export function expectInvalid(
  validate: Validate,
  env: Record<string, string>,
  variable: string,
): ConfigValidationError {
  const merged = { ...VALID_ENV, ...env };
  let error: unknown;
  try {
    validate(merged);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(ConfigValidationError);
  const validationError = error as ConfigValidationError;
  expect(validationError.violations.map((v) => v.variable)).toContain(variable);
  expect(validationError.message).toContain(variable);
  for (const value of Object.values(env)) {
    if (value.length > 3) expect(validationError.message).not.toContain(value);
  }
  return validationError;
}
