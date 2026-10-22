import { ConfigValidationError } from './config-validation-error';
import { validate } from './env.validation';
import { validateTelemetryEnv } from './telemetry.env';
import { expectInvalid, VALID_ENV } from './testing/expect-invalid';

describe('TelemetryEnv', () => {
  it('AC-08.7 exports nothing by default: no endpoint is configured', () => {
    expect(validateTelemetryEnv({})).toMatchObject({
      OTEL_SDK_DISABLED: false,
      OTEL_SERVICE_NAME: 'teams-tasks-api',
    });
    expect(
      validateTelemetryEnv({}).OTEL_EXPORTER_OTLP_ENDPOINT,
    ).toBeUndefined();
  });

  it('AC-08.7 an empty endpoint (a compose pass-through of an unset variable) means telemetry is off', () => {
    expect(
      validateTelemetryEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: '' })
        .OTEL_EXPORTER_OTLP_ENDPOINT,
    ).toBeUndefined();
    expect(
      validate({ ...VALID_ENV, OTEL_EXPORTER_OTLP_ENDPOINT: '' })
        .OTEL_EXPORTER_OTLP_ENDPOINT,
    ).toBeUndefined();
  });

  it('AC-08.7 accepts an http(s) endpoint', () => {
    expect(
      validateTelemetryEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel:4318' })
        .OTEL_EXPORTER_OTLP_ENDPOINT,
    ).toBe('http://otel:4318');
  });

  it('AC-08.7 converts OTEL_SDK_DISABLED to a boolean', () => {
    expect(validateTelemetryEnv({ OTEL_SDK_DISABLED: 'true' })).toMatchObject({
      OTEL_SDK_DISABLED: true,
    });
  });

  it.each([
    ['OTEL_SDK_DISABLED', 'nope'],
    ['OTEL_SERVICE_NAME', ''],
    ['OTEL_EXPORTER_OTLP_ENDPOINT', 'not a url'],
    ['OTEL_EXPORTER_OTLP_ENDPOINT', 'ftp://collector:4318'],
  ])(
    'AC-08.7 %s=%s is rejected by the direct call naming the variable',
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

  it('AC-08.7 the same rules apply through the composed application validate()', () => {
    expectInvalid(
      validate,
      { OTEL_EXPORTER_OTLP_ENDPOINT: 'nope' },
      'OTEL_EXPORTER_OTLP_ENDPOINT',
    );
  });
});
