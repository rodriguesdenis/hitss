import { Transform } from 'class-transformer';
import { TelemetryEnv } from './telemetry.env';
import { integer, isBoolean, oneOf, toBoolean, toNumber } from './transforms';
import {
  IsIn,
  IsInt,
  IsString,
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

/**
 * Every environment variable the API reads. Defaults are documented in `.env.example`
 * (a parity test keeps both in sync). Secret-bearing variables have no default in code:
 * they come from the gitignored `.env` or the process environment.
 */
export class EnvironmentVariables extends TelemetryEnv {
  /** Application environment; distinct from NODE_ENV (which is "production" in the image). */
  @IsIn(APP_ENVS, oneOf(APP_ENVS))
  APP_ENV: AppEnv = 'local';

  @Transform(toNumber)
  @IsInt(integer)
  @Min(1, { message: 'must be at least 1' })
  @Max(65535, { message: 'must be at most 65535' })
  PORT: number = 3000;

  @Matches(/^postgres(ql)?:\/\/\S+$/, {
    message: 'must be a postgresql:// connection URL',
  })
  DATABASE_URL!: string;

  @IsIn(LOG_LEVELS, oneOf(LOG_LEVELS))
  LOG_LEVEL: (typeof LOG_LEVELS)[number] = 'info';

  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  LOG_PRETTY: boolean = false;

  @Transform(toNumber)
  @IsInt(integer)
  @Min(1, { message: 'must be at least 1' })
  RATE_LIMIT_MAX: number = 100;

  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  SEED_ON_START: boolean = true;

  @IsString({ message: 'must be a string' })
  @MinLength(32, { message: 'must be at least 32 characters' })
  BETTER_AUTH_SECRET!: string;
}
