import 'reflect-metadata';
import { plainToInstance, Transform } from 'class-transformer';
import {
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

/**
 * OpenTelemetry settings. Composed into the application `validate()` (EnvironmentVariables extends
 * this class) and validated directly by `src/instrumentation.ts`, which runs before Nest exists.
 */
export class TelemetryEnv {
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
