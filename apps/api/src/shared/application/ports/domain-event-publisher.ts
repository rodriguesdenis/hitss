import type { DomainEvent } from '../../domain/domain-event';

/**
 * Two-phase publication of domain events (plan 002 → cross-context seams). `@nestjs/cqrs`
 * handlers are fire-and-forget and run outside the transaction, so reactions that must be atomic
 * with the write are `@InTransactionHandler`s, awaited inside the unit of work.
 */
export abstract class DomainEventPublisher {
  /**
   * Awaits every `@InTransactionHandler` of each event, in order, inside the current transaction;
   * a failure rolls the whole unit of work back. Throws when no transaction is active.
   */
  abstract publishInTransaction(events: readonly DomainEvent[]): Promise<void>;

  /** After commit: hands the events to the EventBus (logs, metrics); never affects the response. */
  abstract publishAfterCommit(events: readonly DomainEvent[]): void;
}
