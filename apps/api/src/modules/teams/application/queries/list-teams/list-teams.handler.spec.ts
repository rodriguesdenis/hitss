import type { ListTeamsCriteria } from '../../ports/team.read-model';
import type { TeamView } from '../../views/team.view';
import { ListTeamsHandler } from './list-teams.handler';
import { ListTeamsQuery } from './list-teams.query';

const view = (id: string): TeamView => ({
  id,
  name: `Team ${id}`,
  colorHex: '#7C3AED',
  description: null,
  version: 1,
  createdAt: new Date('2026-10-22T10:00:00.000Z'),
  updatedAt: new Date('2026-10-22T10:00:00.000Z'),
});

const CRITERIA: ListTeamsCriteria = {
  page: { limit: 2, offset: 0 },
  search: 'team',
  sort: { field: 'name', direction: 'asc' },
};

describe('ListTeamsHandler', () => {
  const page = jest.fn();
  const countByTeam = jest.fn<
    Promise<ReadonlyMap<string, number>>,
    [string, readonly string[]]
  >();
  const handler = new ListTeamsHandler(
    { page, findById: jest.fn(), summaries: jest.fn() },
    { countByTeam },
  );

  beforeEach(() => {
    page.mockReset();
    countByTeam.mockReset();
  });

  it('AC-02.2.1 returns the owner page with each task count, from ONE count call (no N+1)', async () => {
    page.mockResolvedValue({ items: [view('a'), view('b')], total: 5 });
    countByTeam.mockResolvedValue(new Map([['a', 3]]));

    const result = await handler.execute(
      new ListTeamsQuery('owner-1', CRITERIA),
    );

    expect(page).toHaveBeenCalledWith('owner-1', CRITERIA);
    expect(countByTeam).toHaveBeenCalledTimes(1);
    expect(countByTeam).toHaveBeenCalledWith('owner-1', ['a', 'b']);
    expect(result).toEqual({
      items: [
        { ...view('a'), taskCount: 3 },
        { ...view('b'), taskCount: 0 },
      ],
      total: 5,
    });
  });

  it('AC-02.2.6 an empty page counts nothing', async () => {
    page.mockResolvedValue({ items: [], total: 0 });

    await expect(
      handler.execute(new ListTeamsQuery('owner-1', CRITERIA)),
    ).resolves.toEqual({
      items: [],
      total: 0,
    });
    expect(countByTeam).not.toHaveBeenCalled();
  });
});
