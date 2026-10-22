import { ConfigValidationError } from '../../../../src/config/env.validation';

export const VALID_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  BETTER_AUTH_SECRET: 'unit-test-secret-0123456789abcdef0123456789',
};

export const PRODUCTION_ENV: Record<string, string> = {
  ...VALID_ENV,
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://app:pw@db.internal:5432/app',
  BETTER_AUTH_SECRET: `prod-like-${'x'.repeat(40)}`,
  SEED_ON_START: 'false',
  BETTER_AUTH_URL: 'https://api.example.test',
  CORS_ORIGINS: 'https://app.example.test',
  SEED_DEMO: 'false',
};

type Validate = (config: Record<string, unknown>) => unknown;

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
  const guarded = ['DATABASE_URL', 'BETTER_AUTH_SECRET', variable];
  for (const key of guarded) {
    const value = merged[key];
    if (value && value.length > 5 && !['true', 'false'].includes(value)) {
      expect(validationError.message).not.toContain(value);
    }
  }
  return validationError;
}
