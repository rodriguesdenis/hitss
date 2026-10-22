import { InMemoryTeamRepository } from '../../../../../../test/support/in-memory-team.repository';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-event-publisher';
import { UnitOfWork } from '../../../../../shared/application/ports/unit-of-work';
import type { DomainEvent } from '../../../../../shared/domain/domain-event';
import { Team } from '../../../domain/team';
import { TeamNotFound } from '../../../domain/team.errors';
import { TeamDeleted } from '../../../domain/team.events';
import { ColorHex } from '../../../domain/value-objects/color-hex';
import { TeamDescription } from '../../../domain/value-objects/team-description';
import { TeamName } from '../../../domain/value-objects/team-name';
import { DeleteTeamCommand } from './delete-team.command';
import { DeleteTeamHandler } from './delete-team.handler';

const CREATED = new Date('2026-10-22T10:00:00.000Z');
const LATER = new Date('2026-10-22T11:00:00.000Z');
const MARINA = 'owner-marina';
const ID = '00000000-0000-4000-8000-000000000001';

class FixedClock extends Clock {
  now(): Date {
    return new Date(LATER);
  }
}

/** Records the steps, so the tests can check what ran inside and after the transaction. */
class RecordingUnitOfWork extends UnitOfWork {
  constructor(private readonly log: string[]) {
    super();
  }
  async run<T>(work: () => Promise<T>): Promise<T> {
    this.log.push('begin');
    try {
      const result = await work();
      this.log.push('commit');
      return result;
    } catch (error) {
      this.log.push('rollback');
      throw error;
    }
  }
}

class RecordingPublisher extends DomainEventPublisher {
  constructor(
    private readonly log: string[],
    readonly inTransaction: DomainEvent[] = [],
    readonly afterCommit: DomainEvent[] = [],
  ) {
    super();
  }
  publishInTransaction(events: readonly DomainEvent[]): Promise<void> {
    this.log.push('in-transaction');
    this.inTransaction.push(...events);
    return Promise.resolve();
  }
  publishAfterCommit(events: readonly DomainEvent[]): void {
    this.log.push('after-commit');
    this.afterCommit.push(...events);
  }
}

describe('DeleteTeamHandler', () => {
  let log: string[];
  let repository: InMemoryTeamRepository;
  let publisher: RecordingPublisher;
  let handler: DeleteTeamHandler;

  beforeEach(() => {
    log = [];
    repository = new InMemoryTeamRepository();
    repository.seed(
      Team.create({
        id: ID,
        ownerId: MARINA,
        name: TeamName.create('Mobile'),
        color: ColorHex.create('#7C3AED'),
        description: TeamDescription.create(null),
        now: CREATED,
      }),
    );
    publisher = new RecordingPublisher(log);
    handler = new DeleteTeamHandler(
      repository,
      new FixedClock(),
      new RecordingUnitOfWork(log),
      publisher,
    );
  });

  const remove = (ownerId = MARINA, id = ID) =>
    handler.execute(new DeleteTeamCommand(ownerId, id));

  it('AC-02.7.1 AC-02.9.1 soft-deletes the team, publishes TeamDeleted in the transaction, then after commit', async () => {
    await remove();

    expect(await repository.findById(MARINA, ID)).toBeNull();
    expect(repository.all()[0]?.deletedAt).toEqual(LATER);
    expect(log).toEqual(['begin', 'in-transaction', 'commit', 'after-commit']);
    expect(publisher.inTransaction).toEqual([
      new TeamDeleted(ID, MARINA, LATER),
    ]);
    expect(publisher.afterCommit).toEqual(publisher.inTransaction);
  });

  it('AC-02.7.4 a failing in-transaction reaction rolls back and publishes nothing after commit', async () => {
    jest
      .spyOn(publisher, 'publishInTransaction')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(remove()).rejects.toThrow('boom');
    expect(log).toEqual(['begin', 'rollback']);
    expect(publisher.afterCommit).toEqual([]);
  });

  it.each([
    ['unknown', MARINA, '00000000-0000-4000-8000-000000000099'],
    ['foreign', 'owner-rafael', ID],
  ])(
    'AC-02.9.8 a %s team → 404, nothing published',
    async (_label, ownerId, id) => {
      await expect(remove(ownerId, id)).rejects.toBeInstanceOf(TeamNotFound);
      expect(publisher.inTransaction).toEqual([]);
    },
  );

  it('AC-02.7.3 deleting twice → 404 the second time', async () => {
    await remove();

    await expect(remove()).rejects.toBeInstanceOf(TeamNotFound);
  });
});
