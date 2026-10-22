import { InMemoryTeamDirectory } from '../../../../../../test/support/in-memory-team-directory';
import { Clock } from '../../../../../shared/domain/clock';
import { TaskStatus } from '../../../domain/value-objects/task-status';
import type {
  ListTasksCriteria,
  TaskReadModel,
  TaskRecord,
} from '../../ports/task.read-model';
import { ListTasksHandler } from './list-tasks.handler';
import { ListTasksQuery } from './list-tasks.query';

const OWNER = 'owner-1';
const MOBILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BACKEND = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GONE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const record = (id: string, teamIds: string[]): TaskRecord => ({
  id,
  title: `Task ${id}`,
  description: null,
  status: TaskStatus.PENDING,
  dueDate: '2026-10-20',
  completedAt: null,
  teamIds,
  version: 1,
  createdAt: new Date('2026-10-20T13:00:00.000Z'),
  updatedAt: new Date('2026-10-20T13:00:00.000Z'),
});

const criteria = (
  extra: Partial<ListTasksCriteria> = {},
): ListTasksCriteria => ({
  page: { limit: 20, offset: 0 },
  sort: { field: 'createdAt', direction: 'desc' },
  ...extra,
});

describe('ListTasksHandler', () => {
  let list: jest.Mock;
  let directory: InMemoryTeamDirectory;
  let handler: ListTasksHandler;

  beforeEach(() => {
    list = jest.fn().mockResolvedValue({
      items: [record('t1', [MOBILE, GONE]), record('t2', [MOBILE, BACKEND])],
      total: 7,
    });
    directory = new InMemoryTeamDirectory();
    directory.add(OWNER, { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' });
    directory.add(OWNER, { id: BACKEND, name: 'Backend', colorHex: '#0EA5E9' });
    const clock: Clock = { now: () => new Date('2026-10-22T01:00:00.000Z') };
    handler = new ListTasksHandler(
      { list } as unknown as TaskReadModel,
      directory,
      clock,
    );
  });

  it('AC-03.2.2 assembles full views: live teams by name, overdue on the UTC day, the total kept', async () => {
    const page = await handler.execute(new ListTasksQuery(OWNER, criteria()));

    expect(page.total).toBe(7);
    expect(page.items.map((task) => task.teams.map((t) => t.name))).toEqual([
      ['Mobile'],
      ['Backend', 'Mobile'],
    ]);
    expect(page.items.every((task) => task.isOverdue)).toBe(true);
  });

  it('asks the directory once per page, with every distinct team on it', async () => {
    const summaries = jest.spyOn(directory, 'summaries');

    await handler.execute(new ListTasksQuery(OWNER, criteria()));

    expect(summaries).toHaveBeenCalledTimes(1);
    expect([...(summaries.mock.calls[0]?.[1] ?? [])].sort()).toEqual(
      [MOBILE, BACKEND, GONE].sort(),
    );
  });

  it.each([
    ['deleted or unknown', GONE],
    ['foreign', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'],
  ])(
    'AC-03.3.2 a %s team filter → empty page without querying the tasks',
    async (_label, teamId) => {
      const page = await handler.execute(
        new ListTasksQuery(OWNER, criteria({ teamId })),
      );

      expect(page).toEqual({ items: [], total: 0 });
      expect(list).not.toHaveBeenCalled();
    },
  );

  it('passes a live team filter and the criteria through to the read model', async () => {
    const wanted = criteria({ teamId: MOBILE, statuses: [TaskStatus.DONE] });

    await handler.execute(new ListTasksQuery(OWNER, wanted));

    expect(list).toHaveBeenCalledWith(OWNER, wanted);
  });
});
