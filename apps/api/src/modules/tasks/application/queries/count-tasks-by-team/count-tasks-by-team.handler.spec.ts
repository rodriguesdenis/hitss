import { CountTasksByTeamQuery } from '../../../contracts/count-tasks-by-team.query';
import { CountTasksByTeamHandler } from './count-tasks-by-team.handler';

describe('CountTasksByTeamHandler', () => {
  const countByTeams = jest.fn<
    Promise<ReadonlyMap<string, number>>,
    [string, readonly string[]]
  >();
  const handler = new CountTasksByTeamHandler({ countByTeams } as never);

  beforeEach(() => countByTeams.mockReset());

  it('AC-02.8.1 answers the read model counts for the owner, one query for all distinct ids', async () => {
    const counts = new Map([
      ['a', 2],
      ['b', 0],
    ]);
    countByTeams.mockResolvedValue(counts);

    await expect(
      handler.execute(new CountTasksByTeamQuery('owner-1', ['a', 'b', 'a'])),
    ).resolves.toBe(counts);
    expect(countByTeams).toHaveBeenCalledTimes(1);
    expect(countByTeams).toHaveBeenCalledWith('owner-1', ['a', 'b']);
  });
});
