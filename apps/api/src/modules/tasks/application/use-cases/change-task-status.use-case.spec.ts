import { InMemoryTaskRepository } from '../../../../../test/support/in-memory-task.repository';
import { Clock } from '../../../../shared/domain/clock';
import { Task } from '../../domain/entities/task.entity';
import { TaskNotFound } from '../../domain/errors/task.errors';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { TaskTitle } from '../../domain/value-objects/task-title.vo';
import { ChangeTaskStatusUseCase } from './change-task-status.use-case';

const OWNER = 'owner-1';
const CREATED = new Date('2026-10-20T13:00:00.000Z');
const NOW = new Date('2026-10-21T09:00:00.000Z');

describe('ChangeTaskStatusUseCase', () => {
  let tasks: InMemoryTaskRepository;
  let useCase: ChangeTaskStatusUseCase;
  let ID = '';

  const seed = (status: TaskStatus) => {
    const task = Task.create({
      ownerId: OWNER,
      title: TaskTitle.create('Ship it'),
      description: 'notes',
      dueDate: DueDate.create('2026-10-31'),
      status,
      teamIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      now: CREATED,
    });
    tasks.seed(task);
    ID = task.id;
  };
  const stored = () => tasks.all()[0];

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    const clock: Clock = { now: () => NOW };
    useCase = new ChangeTaskStatusUseCase(tasks, clock);
  });

  const change = (status: TaskStatus, ownerId = OWNER) =>
    useCase.execute({ ownerId, id: ID, status });

  it('AC-03.10.1 AC-03.10.2 entering DONE writes version + 1, completion and updated time now', async () => {
    seed(TaskStatus.IN_PROGRESS);

    await change(TaskStatus.DONE);

    expect(stored()?.version).toBe(2);
    expect(stored()?.completedAt).toEqual(NOW);
    expect(stored()?.updatedAt).toEqual(NOW);
  });

  it('AC-03.10.5 leaves title, description, due date and teams untouched', async () => {
    seed(TaskStatus.PENDING);
    const before = tasks.all()[0];

    await change(TaskStatus.IN_PROGRESS);

    const after = stored();
    expect(after?.title.value).toBe(before?.title.value);
    expect(after?.description).toBe(before?.description);
    expect(after?.dueDate?.value).toBe(before?.dueDate?.value);
    expect(after?.teamIds).toEqual(before?.teamIds);
  });

  it('AC-03.10.3 the current status is a no-op: no update, same version', async () => {
    seed(TaskStatus.DONE);
    const update = jest.spyOn(tasks, 'update');

    await change(TaskStatus.DONE);

    expect(update).not.toHaveBeenCalled();
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
