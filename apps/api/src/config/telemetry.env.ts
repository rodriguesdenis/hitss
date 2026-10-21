import 'reflect-metadata';
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEmpty,
  IsIn,
  IsNotEmpty,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';
import { ConfigValidationError, toViolations } from './config-validation-error';
import { isBoolean, oneOf, toBoolean } from './transforms';

export const SAMPLERS = [
  'always_on',
  'always_off',
  'traceidratio',
  'parentbased_always_on',
  'parentbased_always_off',
  'parentbased_traceidratio',
] as const;
export const OTLP_PROTOCOLS = ['http/protobuf', 'http/json'] as const;

const unsupported = (use: string) => ({
  message: `is not supported; use ${use}`,
});

/**
 * OpenTelemetry settings. Only the variables below are supported: the SDK also honours
 * per-signal endpoints and exporter selection that would bypass this validation, so those are
 * rejected when set. OTEL_EXPORTER_OTLP_HEADERS (may carry credentials) is read by the SDK only
 * and is never logged. Composed into the application `validate()` (EnvironmentVariables extends
 * this class) and validated directly by `src/instrumentation.ts`, which runs before Nest exists.
 */
export class TelemetryEnv {
  @IsEmpty(unsupported('OTEL_EXPORTER_OTLP_ENDPOINT'))
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;

  @IsEmpty(unsupported('OTEL_EXPORTER_OTLP_ENDPOINT'))
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT?: string;

  @IsEmpty(unsupported('OTEL_EXPORTER_OTLP_PROTOCOL'))
  OTEL_EXPORTER_OTLP_TRACES_PROTOCOL?: string;

  @IsEmpty(unsupported('OTEL_EXPORTER_OTLP_PROTOCOL'))
  OTEL_EXPORTER_OTLP_METRICS_PROTOCOL?: string;

  @IsEmpty(unsupported('OTEL_SDK_DISABLED'))
  OTEL_TRACES_EXPORTER?: string;

  @IsEmpty(unsupported('OTEL_SDK_DISABLED'))
  OTEL_METRICS_EXPORTER?: string;

  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  OTEL_SDK_DISABLED: boolean = false;

  @IsString({ message: 'must be a string' })
  @IsNotEmpty({ message: 'must not be empty' })
  OTEL_SERVICE_NAME: string = 'teams-tasks-api';

  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
      protocols: ['http', 'https'],
    },
    { message: 'must be an http(s) URL' },
  )
  OTEL_EXPORTER_OTLP_ENDPOINT: string = 'http://localhost:4318';

  @IsIn(OTLP_PROTOCOLS, oneOf(OTLP_PROTOCOLS))
  OTEL_EXPORTER_OTLP_PROTOCOL: string = 'http/protobuf';

  @IsString({ message: 'must be a string' })
  OTEL_RESOURCE_ATTRIBUTES: string = 'deployment.environment.name=local';

  @IsIn(SAMPLERS, oneOf(SAMPLERS))
  OTEL_TRACES_SAMPLER: string = 'parentbased_always_on';
}

/** Validates only the telemetry variables; throws ConfigValidationError naming each bad one. */
export function validateTelemetryEnv(
  config: Record<string, unknown>,
): TelemetryEnv {
  const env = plainToInstance(TelemetryEnv, config, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(env, { whitelist: false });
  if (errors.length > 0) {
    throw new ConfigValidationError(toViolations(errors));
  }
  return env;
}
