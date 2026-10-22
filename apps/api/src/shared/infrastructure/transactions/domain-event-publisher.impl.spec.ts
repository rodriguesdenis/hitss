import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { EventBus } from '@nestjs/cqrs';
import { DomainEvent } from '../../domain/domain-event';
import {
  InTransactionEventHandler,
  InTransactionHandler,
} from '../../application/in-transaction-handler';
import { CqrsDomainEventPublisher } from './domain-event-publisher.impl';

class Created extends DomainEvent {
  constructor() {
    super(new Date('2026-10-22T10:00:00.000Z'));
  }
}
class Deleted extends DomainEvent {
  constructor() {
    super(new Date('2026-10-22T10:00:00.000Z'));
  }
}

const calls: string[] = [];

@Injectable()
@InTransactionHandler(Deleted)
class First implements InTransactionEventHandler<Deleted> {
  handle(): Promise<void> {
    calls.push('first');
    return Promise.resolve();
  }
}

@Injectable()
@InTransactionHandler(Deleted, Created)
class Second implements InTransactionEventHandler {
  handle(event: DomainEvent): Promise<void> {
    calls.push(`second:${event.constructor.name}`);
    return Promise.resolve();
  }
}

class NotAHandler {}

describe('CqrsDomainEventPublisher', () => {
  const publishAll = jest.fn();
  let active = true;
  const publisher = new CqrsDomainEventPublisher(
    {
      getProviders: () =>
        [new First(), new Second(), new NotAHandler()].map((instance) => ({
          instance,
          metatype: instance.constructor,
        })),
    } as unknown as DiscoveryService,
    { publishAll } as unknown as EventBus,
    { isTransactionActive: () => active },
  );
  publisher.onApplicationBootstrap();

  beforeEach(() => {
    calls.length = 0;
    publishAll.mockReset();
    active = true;
  });

  it('AC-02.7.3 awaits every in-transaction handler of each event, in order', async () => {
    await publisher.publishInTransaction([new Deleted(), new Created()]);

    expect(calls).toEqual(['first', 'second:Deleted', 'second:Created']);
  });

  it('AC-02.7.4 a failing handler rejects, so the unit of work rolls back', async () => {
    jest
      .spyOn(First.prototype, 'handle')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(
      publisher.publishInTransaction([new Deleted()]),
    ).rejects.toThrow('boom');
  });

  it('refuses to run outside a transaction (the reaction would not be atomic)', async () => {
    active = false;

    await expect(
      publisher.publishInTransaction([new Deleted()]),
    ).rejects.toThrow(/transaction/i);
    expect(calls).toEqual([]);
  });

  it('after commit, hands the events to the EventBus', () => {
    const events = [new Deleted()];

    publisher.publishAfterCommit(events);

    expect(publishAll).toHaveBeenCalledWith(events);
  });

  it('publishes nothing after commit for no events', () => {
    publisher.publishAfterCommit([]);

    expect(publishAll).not.toHaveBeenCalled();
  });
});
