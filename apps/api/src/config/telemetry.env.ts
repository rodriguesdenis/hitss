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

export class TelemetryEnv {
  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  OTEL_SDK_DISABLED: boolean = false;

  @IsString({ message: 'must be a string' })
  @IsNotEmpty({ message: 'must not be empty' })
  OTEL_SERVICE_NAME: string = 'teams-tasks-api';

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
