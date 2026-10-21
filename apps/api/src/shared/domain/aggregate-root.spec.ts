import { AggregateRoot } from './aggregate-root';
import { DomainEvent } from './domain-event';

class Happened extends DomainEvent {
  constructor(
    readonly label: string,
    occurredAt: Date,
  ) {
    super(occurredAt);
  }
}

class Sample extends AggregateRoot {
  happen(label: string): void {
    this.raise(new Happened(label, new Date('2026-10-20T10:00:00.000Z')));
  }
}

describe('AggregateRoot', () => {
  it('starts with no events', () => {
    expect(new Sample().pullEvents()).toEqual([]);
  });

  it('returns raised events in order and clears them', () => {
    const aggregate = new Sample();
    aggregate.happen('first');
    aggregate.happen('second');

    const events = aggregate.pullEvents();

    expect(events.map((e) => (e as Happened).label)).toEqual([
      'first',
      'second',
    ]);
    expect(events[0]?.occurredAt).toEqual(new Date('2026-10-20T10:00:00.000Z'));
    expect(aggregate.pullEvents()).toEqual([]);
  });
});
