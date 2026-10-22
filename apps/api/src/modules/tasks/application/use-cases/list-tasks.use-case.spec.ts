import { InMemoryTeamLookup } from '../../../../../test/support/in-memory-team-lookup';
import { Clock } from '../../../../shared/domain/clock';
import { TaskStatus } from '../../domain/value-objects/task-status.vo';
import type {
  ListTasksCriteria,
  TaskReadModel,
  TaskRecord,
} from '../ports/task.read-model';
import { ListTasksUseCase } from './list-tasks.use-case';

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

describe('ListTasksUseCase', () => {
  let list: jest.Mock;
  let directory: InMemoryTeamLookup;
  let handler: ListTasksUseCase;

  beforeEach(() => {
    list = jest.fn().mockResolvedValue({
      items: [record('t1', [MOBILE, GONE]), record('t2', [MOBILE, BACKEND])],
      total: 7,
    });
    directory = new InMemoryTeamLookup();
    directory.add(OWNER, { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' });
    directory.add(OWNER, { id: BACKEND, name: 'Backend', colorHex: '#0EA5E9' });
    const clock: Clock = { now: () => new Date('2026-10-22T01:00:00.000Z') };
    handler = new ListTasksUseCase(
      { list } as unknown as TaskReadModel,
      directory,
      clock,
    );
  });

  it("AC-03.2.2 returns the page with its total, every live team on it and today's UTC day", async () => {
    const view = await handler.execute({
      ownerId: OWNER,
      criteria: criteria(),
    });

    expect(view.page.total).toBe(7);
    expect(view.page.items.map((task) => task.id)).toEqual(['t1', 't2']);
    expect(view.teams.map((t) => t.name).sort()).toEqual(['Backend', 'Mobile']);
    expect(view.today.value).toBe('2026-10-22');
  });

  it('asks the directory once per page, with every distinct team on it', async () => {
    const summaries = jest.spyOn(directory, 'summaries');

    await handler.execute({ ownerId: OWNER, criteria: criteria() });

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
      const view = await handler.execute({
        ownerId: OWNER,
        criteria: criteria({ teamId }),
      });

      expect(view.page).toEqual({ items: [], total: 0 });
      expect(list).not.toHaveBeenCalled();
    },
  );

  it('passes a live team filter and the criteria through to the read model', async () => {
    const wanted = criteria({ teamId: MOBILE, statuses: [TaskStatus.DONE] });

    await handler.execute({ ownerId: OWNER, criteria: wanted });

    expect(list).toHaveBeenCalledWith(OWNER, wanted);
  });
});
