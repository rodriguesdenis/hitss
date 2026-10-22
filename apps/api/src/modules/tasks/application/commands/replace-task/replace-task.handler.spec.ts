import { InMemoryTaskRepository } from '../../../../../../test/support/in-memory-task.repository';
import { InMemoryTeamDirectory } from '../../../../../../test/support/in-memory-team-directory';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-event-publisher';
import { UnitOfWork } from '../../../../../shared/application/ports/unit-of-work';
import { ConcurrencyConflict } from '../../../../../shared/domain/domain-error';
import { Task } from '../../../domain/task';
import { TaskStatusChanged } from '../../../domain/task.events';
import {
  TaskNotFound,
  TooManyTeams,
  UnknownTeams,
} from '../../../domain/task.errors';
import { DueDate } from '../../../domain/value-objects/due-date';
import { TaskDescription } from '../../../domain/value-objects/task-description';
import { TaskStatus } from '../../../domain/value-objects/task-status';
import { TaskTeamIds } from '../../../domain/value-objects/task-team-ids';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { ReplaceTaskCommand } from './replace-task.command';
import { ReplaceTaskHandler } from './replace-task.handler';

/** Runs the work directly; the real unit of work's atomicity is proven in integration. */
const inline: UnitOfWork = { run: (work) => work() };
const OWNER = 'owner-1';
const ID = '11111111-1111-4111-8111-111111111111';
const CREATED = new Date('2026-10-20T13:00:00.000Z');
const NOW = new Date('2026-10-21T09:00:00.000Z');
const team = (n: number) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const [MOBILE, BACKEND, DESIGN] = [team(1), team(2), team(3)];

describe('ReplaceTaskHandler', () => {
  let tasks: InMemoryTaskRepository;
  let directory: InMemoryTeamDirectory;
  /** publishAfterCommit of the fake publisher. */
  let publishAll: jest.Mock;
  let handler: ReplaceTaskHandler;

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    directory = new InMemoryTeamDirectory();
    for (let n = 1; n <= 11; n += 1) {
      directory.add(OWNER, { id: team(n), name: `T${n}`, colorHex: '#7C3AED' });
    }
    const draft = Task.create({
      id: ID,
      ownerId: OWNER,
      title: TaskTitle.create('Draft'),
      description: TaskDescription.create('v1'),
      dueDate: DueDate.create('2026-10-30'),
      status: TaskStatus.PENDING,
      teamIds: TaskTeamIds.of([MOBILE, BACKEND]),
      now: CREATED,
    });
    draft.pullEvents();
    tasks.seed(draft);
    publishAll = jest.fn();
    const clock: Clock = { now: () => NOW };
    handler = new ReplaceTaskHandler(
      tasks,
      directory,
      inline,
      { publishAfterCommit: publishAll } as unknown as DomainEventPublisher,
      clock,
    );
  });

  /** The current state of "Draft", with the given changes. */
  const replace = (
    changes: Partial<Omit<ReplaceTaskCommand, 'ownerId' | 'id'>> = {},
    ownerId = OWNER,
  ) =>
    handler.execute({
      ...new ReplaceTaskCommand(
        ownerId,
        ID,
        'Draft',
        TaskStatus.PENDING,
        [BACKEND, MOBILE],
        'v1',
        '2026-10-30',
      ),
      ...changes,
    });
  const stored = () => tasks.all()[0];

  it('AC-03.9.1 replaces every editable field in one write: version + 1, updated time now, created time kept', async () => {
    await replace({
      title: 'Final',
      description: 'v2',
      status: TaskStatus.IN_PROGRESS,
      dueDate: '2026-11-02',
      teamIds: [DESIGN],
    });

    const task = stored();
    expect(task?.title.value).toBe('Final');
    expect(task?.description.value).toBe('v2');
    expect(task?.status).toBe(TaskStatus.IN_PROGRESS);
    expect(task?.dueDate?.value).toBe('2026-11-02');
    expect(task?.teamIds.values).toEqual([DESIGN]);
    expect(task?.version).toBe(2);
    expect(task?.updatedAt).toEqual(NOW);
    expect(task?.createdAt).toEqual(CREATED);
    expect(publishAll).toHaveBeenCalledWith([expect.any(TaskStatusChanged)]);
  });

  it('AC-03.9.2 omitted description and due date are cleared, and an empty team list unassigns all', async () => {
    await replace({ description: undefined, dueDate: undefined, teamIds: [] });

    expect(stored()?.description.value).toBeNull();
    expect(stored()?.dueDate).toBeNull();
    expect(stored()?.teamIds.values).toEqual([]);
  });

  it('AC-03.9.4 editing into DONE sets the completion time, out of DONE clears it', async () => {
    await replace({ status: TaskStatus.DONE });
    expect(stored()?.completedAt).toEqual(NOW);

    await replace({ status: TaskStatus.PENDING });
    expect(stored()?.completedAt).toBeNull();
  });

  it('AC-03.9.5 an identical replacement (team order ignored) makes no write and keeps the version', async () => {
    const update = jest.spyOn(tasks, 'update');

    await replace();

    expect(update).not.toHaveBeenCalled();
    expect(publishAll).toHaveBeenCalledWith([]);
    expect(stored()?.version).toBe(1);
    expect(stored()?.updatedAt).toEqual(CREATED);
  });

  it('AC-03.9.6 an unknown or foreign task → TaskNotFound, even with too many teams', async () => {
    await expect(
      replace(
        { teamIds: Array.from({ length: 11 }, (_, n) => team(n + 1)) },
        'x',
      ),
    ).rejects.toBeInstanceOf(TaskNotFound);
  });

  it('AC-03.9.3 11 teams → TooManyTeams before team existence; nothing changes', async () => {
    const unknown = Array.from({ length: 11 }, (_, n) => team(100 + n));

    await expect(replace({ teamIds: unknown })).rejects.toBeInstanceOf(
      TooManyTeams,
    );
    expect(stored()?.version).toBe(1);
  });

  it('AC-03.12.3 a team that is not a live team of the owner → UnknownTeams with exactly that id; nothing changes', async () => {
    const never = team(99);

    const error = await replace({ teamIds: [MOBILE, never] }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(UnknownTeams);
    expect((error as UnknownTeams).teamIds).toEqual([never]);
    expect(stored()?.version).toBe(1);
    expect(stored()?.teamIds.values).toEqual([MOBILE, BACKEND].sort());
  });

  it('a write lost to a concurrent one is reloaded and reapplied once', async () => {
    const update = jest
      .spyOn(tasks, 'update')
      .mockRejectedValueOnce(new ConcurrencyConflict(2));

    await replace({ title: 'Final' });

    expect(update).toHaveBeenCalledTimes(2);
    expect(stored()?.title.value).toBe('Final');
  });
});
