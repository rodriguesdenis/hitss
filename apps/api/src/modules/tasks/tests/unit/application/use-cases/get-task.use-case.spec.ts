import { Clock } from '../../../../../../shared/domain/clock';
import { InMemoryTeamDirectory } from '@test/support/in-memory-team-directory';
import { TaskNotFound } from '../../../../domain/errors/task.errors';
import { TaskStatus } from '../../../../domain/value-objects/task-status.vo';
import type {
  TaskReadModel,
  TaskRecord,
} from '../../../../application/interfaces/task-read-model.interface';
import { GetTaskUseCase } from '../../../../application/use-cases/get-task.use-case';

const OWNER = 'owner-1';
const MOBILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GONE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const record: TaskRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Implement login screen',
  description: null,
  status: TaskStatus.PENDING,
  dueDate: '2026-10-21',
  completedAt: null,
  teamIds: [MOBILE, GONE],
  version: 1,
  createdAt: new Date('2026-10-20T13:00:00.000Z'),
  updatedAt: new Date('2026-10-20T13:00:00.000Z'),
};

describe('GetTaskUseCase', () => {
  const handlerAt = (now: string, found: TaskRecord | null) => {
    const findById = jest.fn().mockResolvedValue(found);
    const directory = new InMemoryTeamDirectory();
    directory.add(OWNER, { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' });
    const clock: Clock = { now: () => new Date(now) };
    return {
      handler: new GetTaskUseCase(
        { findById } as unknown as TaskReadModel,
        directory,
        clock,
      ),
      findById,
    };
  };

  it("AC-03.8.1 returns the record, its live teams and today's UTC day from the clock", async () => {
    const { handler, findById } = handlerAt('2026-10-22T01:00:00.000Z', record);

    const view = await handler.execute({ ownerId: OWNER, id: record.id });

    expect(findById).toHaveBeenCalledWith(OWNER, record.id);
    expect(view.task).toBe(record);
    expect(view.teams).toEqual([
      { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' },
    ]);
    expect(view.today.value).toBe('2026-10-22');
  });

  it('today is still the due day one millisecond before UTC midnight', async () => {
    const { handler } = handlerAt('2026-10-21T23:59:59.999Z', record);

    const view = await handler.execute({ ownerId: OWNER, id: record.id });

    expect(view.today.value).toBe('2026-10-21');
  });

  it('throws TaskNotFound when the read model has no such active task', async () => {
    const { handler } = handlerAt('2026-10-21T12:00:00.000Z', null);

    await expect(
      handler.execute({ ownerId: OWNER, id: record.id }),
    ).rejects.toBeInstanceOf(TaskNotFound);
  });
});
