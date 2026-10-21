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

/** The single Prisma client of the API: one pg pool, opened on init, closed on shutdown. */
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
    this.$on('warn', (event) => this.logger.warn(event.message));
    this.$on('error', (event) => this.logger.error(event.message));
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
