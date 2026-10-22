import { ZeroTeamTaskCounts } from './team-task-counts.adapter';

describe('ZeroTeamTaskCounts (placeholder until T-003-14b)', () => {
  it('AC-02.8.3 returns 0 for every requested id', async () => {
    const counts = await new ZeroTeamTaskCounts().countByTeam('owner-1', [
      'a',
      'b',
      'c',
    ]);

    expect([...counts]).toEqual([
      ['a', 0],
      ['b', 0],
      ['c', 0],
    ]);
  });

  it('returns an empty map for no ids', async () => {
    expect(
      (await new ZeroTeamTaskCounts().countByTeam('owner-1', [])).size,
    ).toBe(0);
  });
});
