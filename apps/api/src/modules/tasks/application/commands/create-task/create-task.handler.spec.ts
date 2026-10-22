import { InMemoryTaskRepository } from '../../../../../../test/support/in-memory-task.repository';
import { InMemoryTeamDirectory } from '../../../../../../test/support/in-memory-team-directory';
import { Clock } from '../../../../../shared/domain/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-event-publisher';
import { UnitOfWork } from '../../../../../shared/application/ports/unit-of-work';
import { IdGenerator } from '../../../../../shared/application/ports/id-generator';
import { TaskCreated } from '../../../domain/task.events';
import {
  InvalidTaskTitle,
  TooManyTeams,
  UnknownTeams,
} from '../../../domain/errors/task.errors';
import { TaskStatus } from '../../../domain/value-objects/task-status.vo';
import { CreateTaskCommand } from './create-task.command';
import { CreateTaskHandler } from './create-task.handler';

/** Runs the work directly; the real unit of work's atomicity is proven in integration. */
const inline: UnitOfWork = { run: (work) => work() };
const OWNER = 'owner-1';
const NOW = new Date('2026-10-20T13:00:00.000Z');
const TASK_ID = '11111111-1111-4111-8111-111111111111';
const team = (n: number) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;

describe('CreateTaskHandler', () => {
  let tasks: InMemoryTaskRepository;
  let directory: InMemoryTeamDirectory;
  /** publishAfterCommit of the fake publisher. */
  let publishAll: jest.Mock;
  let handler: CreateTaskHandler;

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    directory = new InMemoryTeamDirectory();
    for (let n = 1; n <= 11; n += 1) {
      directory.add(OWNER, { id: team(n), name: `T${n}`, colorHex: '#7C3AED' });
    }
    publishAll = jest.fn();
    const clock: Clock = { now: () => NOW };
    const ids: IdGenerator = { next: () => TASK_ID };
    handler = new CreateTaskHandler(
      tasks,
      directory,
      inline,
      { publishAfterCommit: publishAll } as unknown as DomainEventPublisher,
      clock,
      ids,
    );
  });

  const create = (overrides: Partial<CreateTaskCommand> = {}) =>
    handler.execute({
      ...new CreateTaskCommand(OWNER, 'Write release notes'),
      ...overrides,
    });

  it('AC-03.1.1 inserts a pending task at version 1 for the owner, publishes TaskCreated and returns its id', async () => {
    await expect(create()).resolves.toEqual({ id: TASK_ID });

    const [task] = tasks.all();
    expect(task).toBeDefined();
    expect(task?.ownerId).toBe(OWNER);
    expect(task?.status).toBe(TaskStatus.PENDING);
    expect(task?.version).toBe(1);
    expect(publishAll).toHaveBeenCalledWith([expect.any(TaskCreated)]);
  });

  it('AC-03.1.4 a task created as DONE has its completion time set to now', async () => {
    await create({ status: TaskStatus.DONE });

    expect(tasks.all()[0]?.completedAt).toEqual(NOW);
  });

  it('AC-03.1.6 assigns live teams of the owner', async () => {
    await create({ teamIds: [team(2), team(1)] });

    expect(tasks.all()[0]?.teamIds.values).toEqual([team(1), team(2)]);
  });

  it('AC-03.1.6 TOO_MANY_TEAMS is checked before team existence, and nothing is written', async () => {
    const unknown = Array.from({ length: 11 }, (_, n) => team(100 + n));

    await expect(create({ teamIds: unknown })).rejects.toBeInstanceOf(
      TooManyTeams,
    );
    expect(tasks.all()).toEqual([]);
    expect(publishAll).not.toHaveBeenCalled();
  });

  it('AC-03.12.3 UNKNOWN_TEAMS lists exactly the ids that are not live teams of the owner, and nothing is written', async () => {
    const gone = team(3);
    directory.remove(gone);
    const never = team(99);

    const error = await create({ teamIds: [team(1), never, gone] }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(UnknownTeams);
    expect([...(error as UnknownTeams).teamIds].sort()).toEqual(
      [gone, never].sort(),
    );
    expect(tasks.all()).toEqual([]);
    expect(publishAll).not.toHaveBeenCalled();
  });

  it('re-validates the title in the domain (defensive)', async () => {
    await expect(create({ title: 'ab' })).rejects.toBeInstanceOf(
      InvalidTaskTitle,
    );
    expect(tasks.all()).toEqual([]);
  });

  it('AC-03.1.6 a team gone between the check and the insert (FK violation) → UnknownTeams with its id, nothing written', async () => {
    // The directory still sees the team at the check, then it is gone for good.
    jest.spyOn(directory, 'findMissing').mockResolvedValueOnce([]);
    tasks.simulateMissingTeam(team(2));
    directory.remove(team(2));

    const error = await create({ teamIds: [team(1), team(2)] }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(UnknownTeams);
    expect((error as UnknownTeams).teamIds).toEqual([team(2)]);
    expect(tasks.all()).toEqual([]);
    expect(publishAll).not.toHaveBeenCalled();
  });
});
