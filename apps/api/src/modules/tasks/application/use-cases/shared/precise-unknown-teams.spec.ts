import { InMemoryTeamLookup } from '../../../../../../test/support/in-memory-team-lookup';
import { TaskNotFound, UnknownTeams } from '../../../domain/errors/task.errors';
import { preciseUnknownTeams } from './precise-unknown-teams';

const OWNER = 'owner-1';
const LIVE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GONE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('preciseUnknownTeams', () => {
  const directory = new InMemoryTeamLookup();
  directory.add(OWNER, { id: LIVE, name: 'Mobile', colorHex: '#7C3AED' });

  it('AC-03.1.6 replaces an UnknownTeams without ids by one listing exactly the missing ids', async () => {
    const error = await preciseUnknownTeams(
      new UnknownTeams([]),
      directory,
      OWNER,
      [LIVE, GONE],
    );

    expect(error).toBeInstanceOf(UnknownTeams);
    expect((error as UnknownTeams).teamIds).toEqual([GONE]);
  });

  it('keeps an UnknownTeams that already lists ids, and any other error, unchanged', async () => {
    const precise = new UnknownTeams([GONE]);
    const other = new TaskNotFound();
    const findMissing = jest.spyOn(directory, 'findMissing');

    await expect(
      preciseUnknownTeams(precise, directory, OWNER, [GONE]),
    ).resolves.toBe(precise);
    await expect(
      preciseUnknownTeams(other, directory, OWNER, [GONE]),
    ).resolves.toBe(other);
    expect(findMissing).not.toHaveBeenCalled();
  });

  it('keeps the original error when the directory finds nothing missing', async () => {
    const empty = new UnknownTeams([]);

    await expect(
      preciseUnknownTeams(empty, directory, OWNER, [LIVE]),
    ).resolves.toBe(empty);
  });
});
