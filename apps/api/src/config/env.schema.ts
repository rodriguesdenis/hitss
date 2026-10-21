import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export const APP_ENVS = ['local', 'test', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

const toNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

const isBoolean = { message: 'must be "true" or "false"' };

/**
 * Every environment variable the API reads. Defaults are documented in `.env.example`
 * (a parity test keeps both in sync). Secret-bearing variables have no default in code:
 * they come from the gitignored `.env` or the process environment.
 */
export class EnvironmentVariables {
  /** Application environment; distinct from NODE_ENV (which is "production" in the image). */
  @IsIn(APP_ENVS)
  APP_ENV: AppEnv = 'local';

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @Matches(/^postgres(ql)?:\/\/\S+$/, {
    message: 'must be a postgresql:// connection URL',
  })
  DATABASE_URL!: string;

  @IsIn(LOG_LEVELS)
  LOG_LEVEL: (typeof LOG_LEVELS)[number] = 'info';

  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  LOG_PRETTY: boolean = false;

  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  OTEL_SDK_DISABLED: boolean = false;

  @IsString()
  @IsNotEmpty()
  OTEL_SERVICE_NAME: string = 'teams-tasks-api';

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  OTEL_EXPORTER_OTLP_ENDPOINT: string = 'http://localhost:4318';

  @IsIn(['http/protobuf', 'http/json'])
  OTEL_EXPORTER_OTLP_PROTOCOL: string = 'http/protobuf';

  @IsString()
  OTEL_RESOURCE_ATTRIBUTES: string = 'deployment.environment.name=local';

  @IsIn([
    'always_on',
    'always_off',
    'traceidratio',
    'parentbased_always_on',
    'parentbased_always_off',
    'parentbased_traceidratio',
  ])
  OTEL_TRACES_SAMPLER: string = 'parentbased_always_on';

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  RATE_LIMIT_MAX: number = 100;

  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  SEED_ON_START: boolean = true;

  @IsString()
  @MinLength(32, { message: 'must be at least 32 characters' })
  BETTER_AUTH_SECRET!: string;
}
