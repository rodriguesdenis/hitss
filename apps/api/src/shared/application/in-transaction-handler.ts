import { SetMetadata } from '@nestjs/common';
import type { DomainEvent } from '../domain/domain-event';

export const IN_TRANSACTION_EVENTS = 'in-transaction-events';

/** A reaction that must commit or roll back with the write that raised the event. */
export interface InTransactionEventHandler<
  E extends DomainEvent = DomainEvent,
> {
  handle(event: E): Promise<void>;
}

/**
 * Registers a provider as an in-transaction handler of the given event classes; the publisher
 * finds it at bootstrap (use instead of `@EventsHandler` for atomic reactions).
 */
export const InTransactionHandler = (
  ...events: (abstract new (...args: never[]) => DomainEvent)[]
) => SetMetadata(IN_TRANSACTION_EVENTS, events);
