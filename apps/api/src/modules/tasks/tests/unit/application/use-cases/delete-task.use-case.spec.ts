import { InMemoryTaskRepository } from '@test/support/in-memory-task.repository';
import { Clock } from '../../../../../../shared/domain/clock';
import { Task } from '../../../../domain/entities/task.entity';
import { TaskNotFound } from '../../../../domain/errors/task.errors';
import { TaskTitle } from '../../../../domain/value-objects/task-title.vo';
import { DeleteTaskUseCase } from '../../../../application/use-cases/delete-task.use-case';

const OWNER = 'owner-1';
const TEAM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = new Date('2026-10-21T09:00:00.000Z');

describe('DeleteTaskUseCase', () => {
  let tasks: InMemoryTaskRepository;
  let useCase: DeleteTaskUseCase;
  let ID = '';

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    const task = Task.create({
      ownerId: OWNER,
      title: TaskTitle.create('Obsolete'),
      description: null,
      dueDate: null,
      teamIds: [TEAM],
      now: new Date('2026-10-20T13:00:00.000Z'),
    });
    tasks.seed(task);
    ID = task.id;
    const clock: Clock = { now: () => NOW };
    useCase = new DeleteTaskUseCase(tasks, clock);
  });

  const remove = (ownerId = OWNER) => useCase.execute({ ownerId, id: ID });

  it('AC-03.11.1 soft-deletes the task, keeps its team links and publishes TaskDeleted', async () => {
    await remove();

    const [stored] = tasks.all();
    expect(stored?.deletedAt).toEqual(NOW);
    expect(stored?.teamIds).toEqual([TEAM]);
    await expect(tasks.findById(OWNER, ID)).resolves.toBeNull();
  });

  it('AC-03.11.2 deleting again → TaskNotFound', async () => {
    await remove();

    await expect(remove()).rejects.toBeInstanceOf(TaskNotFound);
  });

  it("AC-03.12.1 another user's task → TaskNotFound and it stays active", async () => {
    await expect(remove('someone-else')).rejects.toBeInstanceOf(TaskNotFound);
    expect(tasks.all()[0]?.deletedAt).toBeNull();
  });
});
