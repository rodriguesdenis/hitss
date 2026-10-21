import { ConfigValidationError } from './config-validation-error';
import { validate } from './env.validation';
import { validateTelemetryEnv } from './telemetry.env';
import { expectInvalid } from './testing/expect-invalid';

describe('TelemetryEnv', () => {
  it('AC-06.2.6 defaults to the teams-tasks-api service name', () => {
    expect(validateTelemetryEnv({})).toMatchObject({
      OTEL_SDK_DISABLED: false,
      OTEL_SERVICE_NAME: 'teams-tasks-api',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
    });
  });

  it('AC-06.5.3 converts OTEL_SDK_DISABLED to a boolean', () => {
    expect(validateTelemetryEnv({ OTEL_SDK_DISABLED: 'true' })).toMatchObject({
      OTEL_SDK_DISABLED: true,
    });
  });

  it.each([
    ['OTEL_SDK_DISABLED', 'nope'],
    ['OTEL_SERVICE_NAME', ''],
    ['OTEL_EXPORTER_OTLP_ENDPOINT', 'not a url'],
    ['OTEL_EXPORTER_OTLP_ENDPOINT', 'ftp://collector:4318'],
    ['OTEL_EXPORTER_OTLP_PROTOCOL', 'grpc'],
    ['OTEL_TRACES_SAMPLER', 'whenever'],
  ])(
    'AC-06.5.5 %s=%s is rejected by the direct call naming the variable',
    (variable, value) => {
      expect.assertions(2);
      try {
        validateTelemetryEnv({ [variable]: value });
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as Error).message).toContain(variable);
      }
    },
  );

  it.each([
    'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
    'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
    'OTEL_EXPORTER_OTLP_TRACES_PROTOCOL',
    'OTEL_EXPORTER_OTLP_METRICS_PROTOCOL',
    'OTEL_TRACES_EXPORTER',
    'OTEL_METRICS_EXPORTER',
    'OTEL_LOGS_EXPORTER',
    'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
    'OTEL_EXPORTER_OTLP_LOGS_PROTOCOL',
  ])('AC-06.5.5 the unvalidated override %s is rejected', (variable) => {
    expectInvalid(validate, { [variable]: 'http://elsewhere.test' }, variable);
    expect(() => validateTelemetryEnv({ [variable]: 'x' })).toThrow(variable);
  });

  it('AC-06.5.5 empty override values are ignored', () => {
    expect(() =>
      validateTelemetryEnv({ OTEL_TRACES_EXPORTER: '' }),
    ).not.toThrow();
  });

  it('AC-06.5.5 the same rules apply through the composed application validate()', () => {
    expectInvalid(
      validate,
      { OTEL_EXPORTER_OTLP_ENDPOINT: 'nope' },
      'OTEL_EXPORTER_OTLP_ENDPOINT',
    );
  });
});
