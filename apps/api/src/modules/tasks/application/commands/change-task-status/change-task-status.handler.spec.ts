import { EventBus } from '@nestjs/cqrs';
import { InMemoryTaskRepository } from '../../../../../../test/support/in-memory-task.repository';
import { Clock } from '../../../../../shared/application/ports/clock';
import { Task } from '../../../domain/task';
import { TaskStatusChanged } from '../../../domain/task.events';
import { TaskNotFound } from '../../../domain/task.errors';
import { DueDate } from '../../../domain/value-objects/due-date';
import { TaskDescription } from '../../../domain/value-objects/task-description';
import { TaskStatus } from '../../../domain/value-objects/task-status';
import { TaskTeamIds } from '../../../domain/value-objects/task-team-ids';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { ChangeTaskStatusCommand } from './change-task-status.command';
import { ChangeTaskStatusHandler } from './change-task-status.handler';

const OWNER = 'owner-1';
const ID = '11111111-1111-4111-8111-111111111111';
const CREATED = new Date('2026-10-20T13:00:00.000Z');
const NOW = new Date('2026-10-21T09:00:00.000Z');

describe('ChangeTaskStatusHandler', () => {
  let tasks: InMemoryTaskRepository;
  let publishAll: jest.Mock;
  let handler: ChangeTaskStatusHandler;

  const seed = (status: TaskStatus) => {
    const task = Task.create({
      id: ID,
      ownerId: OWNER,
      title: TaskTitle.create('Ship it'),
      description: TaskDescription.create('notes'),
      dueDate: DueDate.create('2026-10-31'),
      status,
      teamIds: TaskTeamIds.of(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']),
      now: CREATED,
    });
    task.pullEvents();
    tasks.seed(task);
  };
  const stored = () => tasks.all()[0];

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    publishAll = jest.fn();
    const clock: Clock = { now: () => NOW };
    handler = new ChangeTaskStatusHandler(
      tasks,
      { publishAll } as unknown as EventBus,
      clock,
    );
  });

  const change = (status: TaskStatus, ownerId = OWNER) =>
    handler.execute(new ChangeTaskStatusCommand(ownerId, ID, status));

  it('AC-03.10.1 AC-03.10.2 entering DONE writes version + 1, completion and updated time now, and publishes the change', async () => {
    seed(TaskStatus.IN_PROGRESS);

    await expect(change(TaskStatus.DONE)).resolves.toEqual({ id: ID });

    expect(stored()?.version).toBe(2);
    expect(stored()?.completedAt).toEqual(NOW);
    expect(stored()?.updatedAt).toEqual(NOW);
    expect(publishAll).toHaveBeenCalledWith([expect.any(TaskStatusChanged)]);
  });

  it('AC-03.10.5 leaves title, description, due date and teams untouched', async () => {
    seed(TaskStatus.PENDING);
    const before = tasks.all()[0];

    await change(TaskStatus.IN_PROGRESS);

    const after = stored();
    expect(after?.title.value).toBe(before?.title.value);
    expect(after?.description.value).toBe(before?.description.value);
    expect(after?.dueDate?.value).toBe(before?.dueDate?.value);
    expect(after?.teamIds.values).toEqual(before?.teamIds.values);
  });

  it('AC-03.10.3 the current status is a no-op: no update, no event, same version', async () => {
    seed(TaskStatus.DONE);
    const update = jest.spyOn(tasks, 'update');

    await change(TaskStatus.DONE);

    expect(update).not.toHaveBeenCalled();
    expect(publishAll).not.toHaveBeenCalled();
    expect(stored()?.version).toBe(1);
    expect(stored()?.completedAt).toEqual(CREATED);
  });

  it('AC-03.10.6 AC-03.12.1 an unknown or foreign task → TaskNotFound, nothing written', async () => {
    seed(TaskStatus.PENDING);

    await expect(
      change(TaskStatus.DONE, 'someone-else'),
    ).rejects.toBeInstanceOf(TaskNotFound);
    expect(stored()?.version).toBe(1);
  });
});
