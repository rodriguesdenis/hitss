import { ConfigValidationError } from '../env.validation';

/** Valid local configuration; tests override single variables on top of it. */
export const VALID_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  BETTER_AUTH_SECRET: 'unit-test-secret-0123456789abcdef0123456789',
};

/** Valid configuration for APP_ENV=production (real-looking values, seed off). */
export const PRODUCTION_ENV: Record<string, string> = {
  ...VALID_ENV,
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://app:pw@db.internal:5432/app',
  // Built at runtime with low entropy so scanners never mistake the fixture for a real secret.
  BETTER_AUTH_SECRET: `prod-like-${'x'.repeat(40)}`,
  SEED_ON_START: 'false',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'https://collector.example.test:4318',
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
  // Secrets and the offending value must never be echoed (booleans and enum words are not secrets).
  const guarded = ['DATABASE_URL', 'BETTER_AUTH_SECRET', variable];
  for (const key of guarded) {
    const value = merged[key];
    if (value && value.length > 5 && !['true', 'false'].includes(value)) {
      expect(validationError.message).not.toContain(value);
    }
  }
  return validationError;
}
