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
import { blankToUndefined, isBoolean, toBoolean } from './transforms';

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

  /** Absent or empty (docker compose passes an unset variable through as ""): nothing is exported. */
  @Transform(blankToUndefined)
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

  /**
   * Per-signal endpoints are read by the SDK too and would bypass the https rule on the generic
   * one, so production refuses them (see production-rules.ts).
   */
  @IsOptional()
  @IsString({ message: 'must be a string' })
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;

  @IsOptional()
  @IsString({ message: 'must be a string' })
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT?: string;

  @IsOptional()
  @IsString({ message: 'must be a string' })
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?: string;
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
