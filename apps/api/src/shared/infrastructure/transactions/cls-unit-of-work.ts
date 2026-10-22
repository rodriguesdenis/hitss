import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { UnitOfWork } from '../../application/ports/unit-of-work';
import type { PrismaService } from '../prisma/prisma.service';

/** The Prisma client of the ambient transaction (or the base client outside one). */
export type PrismaTransactionHost = TransactionHost<
  TransactionalAdapterPrisma<PrismaService>
>;

/**
 * UnitOfWork over `@nestjs-cls/transactional`: repositories read `txHost.tx`, so everything inside
 * `run` shares one Prisma interactive transaction. A nested `run` joins the open one.
 */
@Injectable()
export class ClsUnitOfWork extends UnitOfWork {
  constructor(
    @Inject(TransactionHost) private readonly txHost: PrismaTransactionHost,
  ) {
    super();
  }

  /**
   * Must stay READ COMMITTED (PostgreSQL's default; no isolation level is set here); the
   * TeamDeleted/link lock relies on it (TaskRepository.lockTeamLinks). Under REPEATABLE READ the
   * reaction would miss links committed while it waited.
   */
  run<T>(work: () => Promise<T>): Promise<T> {
    return this.txHost.withTransaction(work);
  }
}
