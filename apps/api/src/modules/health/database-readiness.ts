import { Inject, Injectable, Optional } from '@nestjs/common';
import { probeDatabase } from '../../shared/infrastructure/prisma/database-probe';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

export const DATABASE_READINESS_TIMEOUT_MS = 1_500;

export const DATABASE_READINESS_TIMEOUT = Symbol('DATABASE_READINESS_TIMEOUT');

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
