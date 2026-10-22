import { Global, Module } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { CqrsModule, EventBus } from '@nestjs/cqrs';
import {
  ClsPluginTransactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsModule } from 'nestjs-cls';
import { DomainEventPublisher } from '../../application/ports/domain-event-publisher';
import { UnitOfWork } from '../../application/ports/unit-of-work';
import { PrismaService } from '../prisma/prisma.service';
import { ClsUnitOfWork } from './cls-unit-of-work';
import { CqrsDomainEventPublisher } from './domain-event-publisher.impl';

/**
 * Transactions for the whole API (plan 002, ADR-0002): CLS context per request (middleware),
 * the Prisma transactional plugin (`TransactionHost`), and the UnitOfWork and
 * DomainEventPublisher ports. Global, so every module's repositories can inject TransactionHost.
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: PrismaService,
            sqlFlavor: 'postgresql',
          }),
        }),
      ],
    }),
    DiscoveryModule,
    CqrsModule,
  ],
  providers: [
    { provide: UnitOfWork, useClass: ClsUnitOfWork },
    {
      provide: DomainEventPublisher,
      inject: [DiscoveryService, EventBus, TransactionHost],
      useFactory: (
        discovery: DiscoveryService,
        eventBus: EventBus,
        txHost: TransactionHost,
      ) => new CqrsDomainEventPublisher(discovery, eventBus, txHost),
    },
  ],
  exports: [UnitOfWork, DomainEventPublisher],
})
export class TransactionsModule {}
