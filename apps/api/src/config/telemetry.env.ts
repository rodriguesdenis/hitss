import 'reflect-metadata';
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';
import { ConfigValidationError, toViolations } from './config-validation-error';
import { isBoolean, toBoolean } from './transforms';

/**
 * OpenTelemetry settings. Telemetry is exported only when OTEL_EXPORTER_OTLP_ENDPOINT is set
 * (AC-08.7). Composed into the application `validate()` (EnvironmentVariables extends this class)
 * and validated directly by `src/instrumentation.ts`, which runs before Nest exists.
 */
export class TelemetryEnv {
  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  OTEL_SDK_DISABLED: boolean = false;

  @IsString({ message: 'must be a string' })
  @IsNotEmpty({ message: 'must not be empty' })
  OTEL_SERVICE_NAME: string = 'teams-tasks-api';

  /** Absent: nothing is exported. */
  @IsOptional()
  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
      protocols: ['http', 'https'],
    },
    { message: 'must be an http(s) URL' },
  )
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
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
