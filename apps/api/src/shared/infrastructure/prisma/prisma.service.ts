import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { APP_CONFIG } from '../../../config/app-config';
import type { AppConfig } from '../../../config/app-config';
import { Prisma, PrismaClient } from '../../../generated/prisma/client';
import { DATABASE_PROBE_TIMEOUT_MS, probeDatabase } from './database-probe';

// Prisma logs are emitted as events and routed to the Nest logger (pino once 006 lands).
const PRISMA_LOG = [
  { emit: 'event', level: 'query' },
  { emit: 'event', level: 'warn' },
  { emit: 'event', level: 'error' },
] satisfies Prisma.LogDefinition[];

type PrismaServiceOptions = { adapter: PrismaPg; log: typeof PRISMA_LOG };

/** A query log entry: the parameterized statement only, never its bound values (may hold PII). */
export function toQueryLog(event: Prisma.QueryEvent) {
  return {
    msg: 'prisma.query',
    query: event.query,
    durationMs: event.duration,
  };
}

const SQLSTATE = /Code: `([0-9A-Z]{5})`/;
const PRISMA_CODE = /\b(P\d{4})\b/;
const CONSTRAINT = /constraint "([\w.$-]{1,128})"/;

/**
 * A warn/error log entry reduced to identifiers: the client method, the SQLSTATE or Prisma error
 * code and the constraint name. The raw message is never logged, because driver messages and
 * DETAIL lines echo values (`Key (email)=(...) already exists`). Callers still receive the full
 * error.
 */
export function toLogEventLog(level: 'warn' | 'error', event: Prisma.LogEvent) {
  const code = (SQLSTATE.exec(event.message) ??
    PRISMA_CODE.exec(event.message))?.[1];
  const constraint = CONSTRAINT.exec(event.message)?.[1];
  return {
    msg: `prisma.${level}`,
    target: event.target,
    ...(code && { code }),
    ...(constraint && { constraint }),
  };
}

/**
 * The single Prisma client of the API: one pg pool, probed on init (fail fast), closed on
 * shutdown.
 */
@Injectable()
export class PrismaService
  extends PrismaClient<PrismaServiceOptions>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({
      adapter: new PrismaPg({ connectionString: config.databaseUrl }),
      log: PRISMA_LOG,
    });
    this.$on('query', (event) => this.logger.debug(toQueryLog(event)));
    this.$on('warn', (event) => this.logger.warn(toLogEventLog('warn', event)));
    this.$on('error', (event) =>
      this.logger.error(toLogEventLog('error', event)),
    );
  }

  /**
   * $connect opens nothing with the pg adapter, so a probe query proves the database answers.
   * A failure aborts the Nest bootstrap and the process exits non-zero (VII.3).
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    await probeDatabase(
      () => this.$queryRaw`SELECT 1`,
      DATABASE_PROBE_TIMEOUT_MS,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
