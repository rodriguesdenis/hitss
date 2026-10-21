import { DomainEvent } from './domain-event';

/** Collects the domain events raised by an aggregate until a handler pulls them. */
export abstract class AggregateRoot {
  private events: DomainEvent[] = [];

  /** Returns the pending events, oldest first, and clears them. */
  pullEvents(): DomainEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  protected raise(event: DomainEvent): void {
    this.events.push(event);
  }
}
