import type { TeamLookup } from '../../../teams/team-lookup.service';
import { TeamLookupDirectory } from './team-directory.adapter';

const MOBILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BACKEND = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('TeamLookupDirectory', () => {
  const lookup = { summaries: jest.fn(), findMissing: jest.fn() };
  const directory = new TeamLookupDirectory(lookup as unknown as TeamLookup);

  beforeEach(() => jest.resetAllMocks());

  it("asks TeamLookup for the owner's teams and keeps only id, name and color", async () => {
    lookup.summaries.mockResolvedValue([
      { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED', extra: 'ignored' },
    ]);

    const summaries = await directory.summaries('owner-1', [MOBILE]);

    expect(lookup.summaries).toHaveBeenCalledWith('owner-1', [MOBILE]);
    expect(summaries).toEqual([
      { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' },
    ]);
  });

  it('returns the ids TeamLookup reports missing', async () => {
    lookup.findMissing.mockResolvedValue([BACKEND]);

    await expect(
      directory.findMissing('owner-1', [BACKEND, MOBILE]),
    ).resolves.toEqual([BACKEND]);
    expect(lookup.findMissing).toHaveBeenCalledWith('owner-1', [
      BACKEND,
      MOBILE,
    ]);
  });
});
