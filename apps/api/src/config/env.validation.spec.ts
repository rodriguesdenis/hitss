import { toAppConfig } from './app-config';
import { validate, validateWith } from './env.validation';
import { productionRules } from './production-rules';
import {
  expectInvalid,
  PRODUCTION_ENV,
  VALID_ENV,
} from './testing/expect-invalid';

const check = (env: Record<string, string>, variable: string) =>
  expectInvalid(validate, env, variable);

describe('environment validation', () => {
  it('AC-07.1.4 accepts the required variables and applies documented local defaults', () => {
    const config = toAppConfig(validate({ ...VALID_ENV }));

    expect(config).toMatchObject({
      appEnv: 'local',
      port: 3000,
      logLevel: 'info',
      logPretty: false,
      seedOnStart: true,
      rateLimitMax: 100,
      otel: { sdkDisabled: false, serviceName: 'teams-tasks-api' },
    });
  });

  it('AC-07.1.4 converts strings to numbers and booleans', () => {
    const config = toAppConfig(
      validate({
        ...VALID_ENV,
        PORT: '3100',
        LOG_PRETTY: 'true',
        SEED_ON_START: 'false',
        RATE_LIMIT_MAX: '5',
      }),
    );

    expect(config).toMatchObject({
      port: 3100,
      logPretty: true,
      seedOnStart: false,
      rateLimitMax: 5,
    });
  });

  it.each([
    ['APP_ENV', 'staging'],
    ['PORT', '70000'],
    ['PORT', 'abc'],
    ['PORT', '0'],
    ['DATABASE_URL', 'mysql://secret-host/db'],
    ['LOG_LEVEL', 'verbose'],
    ['LOG_PRETTY', 'maybe'],
    ['SEED_ON_START', 'yes-please'],
    ['RATE_LIMIT_MAX', '0'],
    ['RATE_LIMIT_MAX', '1.5'],
    ['OTEL_SDK_DISABLED', 'nope'],
    ['OTEL_EXPORTER_OTLP_ENDPOINT', 'not a url'],
    ['OTEL_EXPORTER_OTLP_PROTOCOL', 'carrier-pigeon'],
    ['OTEL_TRACES_SAMPLER', 'whenever'],
    ['BETTER_AUTH_SECRET', 'too-short'],
  ])(
    'AC-06.5.5 %s=%s is rejected naming the variable, not the value',
    (variable, value) => {
      check({ [variable]: value }, variable);
    },
  );

  it.each(['DATABASE_URL', 'BETTER_AUTH_SECRET'])(
    'AC-07.1.4 %s has no default in code and is reported when missing',
    (variable) => {
      const env: Record<string, unknown> = { ...VALID_ENV };
      delete env[variable];

      expect(() => validate(env)).toThrow(variable);
    },
  );

  it('AC-06.5.5 several invalid variables produce one error listing all of them', () => {
    let error: unknown;
    try {
      validate({
        ...VALID_ENV,
        PORT: '99999',
        LOG_LEVEL: 'loud',
        APP_ENV: 'x',
      });
    } catch (e) {
      error = e;
    }

    const message = (error as Error).message;
    expect(message).toContain('PORT');
    expect(message).toContain('LOG_LEVEL');
    expect(message).toContain('APP_ENV');
    expect(message).not.toContain('99999');
    expect(message).not.toContain('loud');
  });
});

describe('production rules', () => {
  const production = PRODUCTION_ENV;

  it('AC-06.5.5 APP_ENV=production accepts a fully valid production configuration', () => {
    expect(() => validate({ ...production })).not.toThrow();
  });

  it.each([
    'local-dev-secret-change-me-0123456789abcdef',
    'unit-test-secret-0123456789abcdef0123456789',
  ])(
    'AC-06.5.5 APP_ENV=production refuses the placeholder secret %s',
    (secret) => {
      expectInvalid(
        validate,
        { ...production, BETTER_AUTH_SECRET: secret },
        'BETTER_AUTH_SECRET',
      );
    },
  );

  it('AC-06.5.5 APP_ENV=production refuses the local placeholder database password', () => {
    expectInvalid(
      validate,
      {
        ...production,
        DATABASE_URL: 'postgresql://teams:teams-local-only@db:5432/teams',
      },
      'DATABASE_URL',
    );
  });

  it('AC-06.5.5 APP_ENV=production refuses SEED_ON_START=true', () => {
    expectInvalid(
      validate,
      { ...production, SEED_ON_START: 'true' },
      'SEED_ON_START',
    );
  });

  it('AC-07.1.4 APP_ENV=local accepts the placeholders even when NODE_ENV=production (the image)', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() =>
        validate({
          ...VALID_ENV,
          APP_ENV: 'local',
          NODE_ENV: 'production',
          SEED_ON_START: 'true',
          BETTER_AUTH_SECRET: 'local-dev-secret-change-me-0123456789abcdef',
        }),
      ).not.toThrow();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('AC-07.1.4 an extra rule registers without changing validate()', () => {
    const extra = (config: { PORT: number }) =>
      config.PORT === 3000
        ? [{ variable: 'PORT', message: 'must not keep the default port' }]
        : [];
    const strict = validateWith([...productionRules, extra]);

    expectInvalid(strict, production, 'PORT');
    expect(() => validate({ ...production })).not.toThrow();
  });

  it('AC-07.1.4 rules do not run outside production', () => {
    const always = () => [{ variable: 'PORT', message: 'always fails' }];
    const strict = validateWith([always]);

    expect(() => strict({ ...VALID_ENV, APP_ENV: 'local' })).not.toThrow();
    expectInvalid(strict, production, 'PORT');
  });
});
