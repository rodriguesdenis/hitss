import { Clock } from '../../../../../shared/domain/clock';
import { InMemoryTeamDirectory } from '../../../../../../test/support/in-memory-team-directory';
import { TaskNotFound } from '../../../domain/errors/task.errors';
import { TaskStatus } from '../../../domain/value-objects/task-status.vo';
import type { TaskReadModel, TaskRecord } from '../../ports/task.read-model';
import { GetTaskHandler } from './get-task.handler';
import { GetTaskQuery } from './get-task.query';

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

describe('GetTaskHandler', () => {
  const handlerAt = (now: string, found: TaskRecord | null) => {
    const findById = jest.fn().mockResolvedValue(found);
    const directory = new InMemoryTeamDirectory();
    directory.add(OWNER, { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' });
    const clock: Clock = { now: () => new Date(now) };
    return {
      handler: new GetTaskHandler(
        { findById } as unknown as TaskReadModel,
        directory,
        clock,
      ),
      findById,
    };
  };

  it('AC-03.8.1 returns the view with live teams only, overdue judged on the UTC day of the clock', async () => {
    // 2026-10-22T01:00 in UTC, still 2026-10-21 in São Paulo: the due day has passed in UTC.
    const { handler, findById } = handlerAt('2026-10-22T01:00:00.000Z', record);

    const view = await handler.execute(new GetTaskQuery(OWNER, record.id));

    expect(findById).toHaveBeenCalledWith(OWNER, record.id);
    expect(view.teams).toEqual([
      { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' },
    ]);
    expect(view.isOverdue).toBe(true);
  });

  it('is not overdue on the due day itself', async () => {
    const { handler } = handlerAt('2026-10-21T23:59:59.999Z', record);

    const view = await handler.execute(new GetTaskQuery(OWNER, record.id));

    expect(view.isOverdue).toBe(false);
  });

  it('throws TaskNotFound when the read model has no such active task', async () => {
    const { handler } = handlerAt('2026-10-21T12:00:00.000Z', null);

    await expect(
      handler.execute(new GetTaskQuery(OWNER, record.id)),
    ).rejects.toBeInstanceOf(TaskNotFound);
  });
});
