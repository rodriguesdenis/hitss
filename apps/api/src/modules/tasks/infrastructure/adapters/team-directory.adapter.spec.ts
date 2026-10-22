import { QueryBus } from '@nestjs/cqrs';
import { GetTeamSummariesQuery } from '../../../teams/contracts/get-team-summaries.query';
import { QueryBusTeamDirectory } from './team-directory.adapter';

const MOBILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BACKEND = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('QueryBusTeamDirectory', () => {
  const directoryAnswering = (teams: object[]) => {
    const execute = jest.fn().mockResolvedValue(teams);
    return {
      directory: new QueryBusTeamDirectory({ execute } as unknown as QueryBus),
      execute,
    };
  };

  it('sends GetTeamSummariesQuery and keeps only id, name and color', async () => {
    const { directory, execute } = directoryAnswering([
      { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED', extra: 'ignored' },
    ]);

    const summaries = await directory.summaries('owner-1', [MOBILE]);

    expect(execute).toHaveBeenCalledWith(
      new GetTeamSummariesQuery('owner-1', [MOBILE]),
    );
    expect(summaries).toEqual([
      { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' },
    ]);
  });

  it('reports the ids Team Management did not return, in input order', async () => {
    const { directory } = directoryAnswering([
      { id: MOBILE, name: 'Mobile', colorHex: '#7C3AED' },
    ]);

    await expect(
      directory.findMissing('owner-1', [BACKEND, MOBILE.toUpperCase(), 'x']),
    ).resolves.toEqual([BACKEND, 'x']);
  });

  it('does not query for an empty list', async () => {
    const { directory, execute } = directoryAnswering([]);

    await expect(directory.summaries('owner-1', [])).resolves.toEqual([]);
    await expect(directory.findMissing('owner-1', [])).resolves.toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
});
