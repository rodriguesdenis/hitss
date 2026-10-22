import { Inject, Injectable, Optional } from '@nestjs/common';
import { probeDatabase } from '../../shared/infrastructure/prisma/database-probe';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

/** Inside the 2 s the spec allows for a "service unavailable" answer (AC-06.1.3). */
export const DATABASE_READINESS_TIMEOUT_MS = 1_500;

/** DI token for the bound; absent in production, tests may shorten it. */
export const DATABASE_READINESS_TIMEOUT = Symbol('DATABASE_READINESS_TIMEOUT');

/**
 * Whether the API can serve: the database answers `SELECT 1` (BR-06.7). The same probe as the boot
 * check (`probeDatabase`), bounded; at most one query is outstanding, so probes against a hung
 * database wait on the same attempt instead of each taking a pool connection.
 */
@Injectable()
export class DatabaseReadiness {
  private pending: Promise<void> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(DATABASE_READINESS_TIMEOUT)
    private readonly timeoutMs: number = DATABASE_READINESS_TIMEOUT_MS,
  ) {}

  async check(): Promise<boolean> {
    // probeDatabase keeps a handler on the attempt, so a failure after the bound is not unhandled.
    this.pending ??= this.query().finally(() => {
      this.pending = undefined;
    });
    const attempt = this.pending;
    try {
      await probeDatabase(() => attempt, this.timeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  private query(): Promise<void> {
    return Promise.resolve(this.prisma.$queryRaw`SELECT 1`).then(
      () => undefined,
    );
  }
}
