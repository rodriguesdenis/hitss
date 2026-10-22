import type { TeamView } from '../../views/team.view';
import { TeamNotFound } from '../../../domain/team.errors';
import { GetTeamHandler } from './get-team.handler';
import { GetTeamQuery } from './get-team.query';

const VIEW: TeamView = {
  id: '7d0c5e2a-3f1b-4c8e-9a6d-2b4f8e1c0a93',
  name: 'Mobile',
  colorHex: '#7C3AED',
  description: null,
  version: 1,
  createdAt: new Date('2026-10-22T10:00:00.000Z'),
  updatedAt: new Date('2026-10-22T10:00:00.000Z'),
};

describe('GetTeamHandler', () => {
  const findById = jest.fn<Promise<TeamView | null>, [string, string]>();
  const countByTeam = jest.fn<
    Promise<ReadonlyMap<string, number>>,
    [string, readonly string[]]
  >();
  const handler = new GetTeamHandler(
    { findById, page: jest.fn() },
    { countByTeam },
  );

  beforeEach(() => {
    findById.mockReset();
    countByTeam.mockReset();
  });

  it('AC-02.8.3 returns the owner-scoped view with its task count', async () => {
    findById.mockResolvedValue(VIEW);
    countByTeam.mockResolvedValue(new Map([[VIEW.id, 0]]));

    await expect(
      handler.execute(new GetTeamQuery('owner-1', VIEW.id)),
    ).resolves.toEqual({
      ...VIEW,
      taskCount: 0,
    });
    expect(findById).toHaveBeenCalledWith('owner-1', VIEW.id);
    expect(countByTeam).toHaveBeenCalledWith('owner-1', [VIEW.id]);
  });

  it('a count missing from the map is 0', async () => {
    findById.mockResolvedValue(VIEW);
    countByTeam.mockResolvedValue(new Map());

    await expect(
      handler.execute(new GetTeamQuery('owner-1', VIEW.id)),
    ).resolves.toMatchObject({
      taskCount: 0,
    });
  });

  it('an unknown, deleted or foreign team → TeamNotFound, without counting', async () => {
    findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetTeamQuery('owner-1', VIEW.id)),
    ).rejects.toBeInstanceOf(TeamNotFound);
    expect(countByTeam).not.toHaveBeenCalled();
  });
});
