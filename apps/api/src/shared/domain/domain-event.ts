/** Something that happened in an aggregate. Plain data, no behavior. */
export abstract class DomainEvent {
  protected constructor(readonly occurredAt: Date) {}
}
