import { TeamReadModel } from './application/ports/team.read-model';
import { TeamLookup } from './team-lookup.service';

const MOBILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BACKEND = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('TeamLookup', () => {
  const summaries = jest.fn();
  const lookup = new TeamLookup({ summaries } as unknown as TeamReadModel);

  beforeEach(() => summaries.mockReset());

  it('asks the read model for the owner’s summaries of exactly the requested ids', async () => {
    const summary = { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' };
    summaries.mockResolvedValue([summary]);

    await expect(
      lookup.summaries('owner-1', [MOBILE, BACKEND]),
    ).resolves.toEqual([summary]);
    expect(summaries).toHaveBeenCalledWith('owner-1', [MOBILE, BACKEND]);
  });

  it('reports the ids that are not live teams of the owner, in input order, ignoring letter case', async () => {
    summaries.mockResolvedValue([
      { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' },
    ]);

    await expect(
      lookup.findMissing('owner-1', [BACKEND, MOBILE.toUpperCase(), 'x']),
    ).resolves.toEqual([BACKEND, 'x']);
  });

  it('does not query for an empty list', async () => {
    await expect(lookup.summaries('owner-1', [])).resolves.toEqual([]);
    await expect(lookup.findMissing('owner-1', [])).resolves.toEqual([]);
    expect(summaries).not.toHaveBeenCalled();
  });

  describe('assertAllLive', () => {
    const toError = (missing: string[]) =>
      new Error(`missing: ${missing.join(',')}`);

    it('AC-03.1.6 throws the caller’s error naming exactly the missing ids', async () => {
      summaries.mockResolvedValue([
        { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' },
      ]);

      await expect(
        lookup.assertAllLive('owner-1', [MOBILE, BACKEND], toError),
      ).rejects.toThrow(`missing: ${BACKEND}`);
    });

    it('resolves when every id is a live team of the owner, or there are none', async () => {
      summaries.mockResolvedValue([
        { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' },
      ]);

      await expect(
        lookup.assertAllLive('owner-1', [MOBILE], toError),
      ).resolves.toBeUndefined();
      await expect(
        lookup.assertAllLive('owner-1', [], toError),
      ).resolves.toBeUndefined();
    });
  });
});
