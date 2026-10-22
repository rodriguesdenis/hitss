import { EventBus } from '@nestjs/cqrs';
import { InMemoryTaskRepository } from '../../../../../../test/support/in-memory-task.repository';
import { Clock } from '../../../../../shared/application/ports/clock';
import { Task } from '../../../domain/task';
import { TaskDeleted } from '../../../domain/task.events';
import { TaskNotFound } from '../../../domain/task.errors';
import { TaskDescription } from '../../../domain/value-objects/task-description';
import { TaskTeamIds } from '../../../domain/value-objects/task-team-ids';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { DeleteTaskCommand } from './delete-task.command';
import { DeleteTaskHandler } from './delete-task.handler';

const OWNER = 'owner-1';
const ID = '11111111-1111-4111-8111-111111111111';
const TEAM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = new Date('2026-10-21T09:00:00.000Z');

describe('DeleteTaskHandler', () => {
  let tasks: InMemoryTaskRepository;
  let publishAll: jest.Mock;
  let handler: DeleteTaskHandler;

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    const task = Task.create({
      id: ID,
      ownerId: OWNER,
      title: TaskTitle.create('Obsolete'),
      description: TaskDescription.create(null),
      dueDate: null,
      teamIds: TaskTeamIds.of([TEAM]),
      now: new Date('2026-10-20T13:00:00.000Z'),
    });
    task.pullEvents();
    tasks.seed(task);
    publishAll = jest.fn();
    const clock: Clock = { now: () => NOW };
    handler = new DeleteTaskHandler(
      tasks,
      { publishAll } as unknown as EventBus,
      clock,
    );
  });

  const remove = (ownerId = OWNER) =>
    handler.execute(new DeleteTaskCommand(ownerId, ID));

  it('AC-03.11.1 soft-deletes the task, keeps its team links and publishes TaskDeleted', async () => {
    await remove();

    const [stored] = tasks.all();
    expect(stored?.deletedAt).toEqual(NOW);
    expect(stored?.teamIds.values).toEqual([TEAM]);
    expect(publishAll).toHaveBeenCalledWith([expect.any(TaskDeleted)]);
    await expect(tasks.findById(OWNER, ID)).resolves.toBeNull();
  });

  it('AC-03.11.2 deleting again → TaskNotFound, nothing published', async () => {
    await remove();
    publishAll.mockClear();

    await expect(remove()).rejects.toBeInstanceOf(TaskNotFound);
    expect(publishAll).not.toHaveBeenCalled();
  });

  it("AC-03.12.1 another user's task → TaskNotFound and it stays active", async () => {
    await expect(remove('someone-else')).rejects.toBeInstanceOf(TaskNotFound);
    expect(tasks.all()[0]?.deletedAt).toBeNull();
  });
});
