import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { EventBus } from '@nestjs/cqrs';
import {
  IN_TRANSACTION_EVENTS,
  InTransactionEventHandler,
} from '../../application/in-transaction-handler';
import { DomainEventPublisher } from '../../application/ports/domain-event-publisher';
import type { DomainEvent } from '../../domain/domain-event';

/** What the publisher needs from the transaction host: whether a transaction is open. */
export interface TransactionState {
  isTransactionActive(): boolean;
}

/**
 * In-transaction handlers are discovered at bootstrap from `@InTransactionHandler` metadata and
 * awaited inside the unit of work; after commit the events go to `@nestjs/cqrs`'s EventBus.
 */
@Injectable()
export class CqrsDomainEventPublisher
  extends DomainEventPublisher
  implements OnApplicationBootstrap
{
  private readonly handlers = new Map<object, InTransactionEventHandler[]>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly eventBus: EventBus,
    private readonly transaction: TransactionState,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    for (const { instance, metatype } of this.discovery.getProviders()) {
      const events = metatype
        ? (Reflect.getMetadata(IN_TRANSACTION_EVENTS, metatype) as
            object[] | undefined)
        : undefined;
      for (const event of events ?? []) {
        const registered = this.handlers.get(event) ?? [];
        registered.push(instance as InTransactionEventHandler);
        this.handlers.set(event, registered);
      }
    }
  }

  async publishInTransaction(events: readonly DomainEvent[]): Promise<void> {
    if (events.length > 0 && !this.transaction.isTransactionActive()) {
      throw new Error(
        'In-transaction handlers need an active transaction (UnitOfWork.run).',
      );
    }
    for (const event of events) {
      for (const handler of this.handlers.get(event.constructor) ?? []) {
        await handler.handle(event);
      }
    }
  }

  publishAfterCommit(events: readonly DomainEvent[]): void {
    if (events.length > 0) {
      this.eventBus.publishAll([...events]);
    }
  }
}
