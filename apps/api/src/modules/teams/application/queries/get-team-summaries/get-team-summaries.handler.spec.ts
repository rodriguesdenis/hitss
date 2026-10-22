import { GetTeamSummariesQuery } from '../../../contracts/get-team-summaries.query';
import { TeamReadModel } from '../../ports/team.read-model';
import { GetTeamSummariesHandler } from './get-team-summaries.handler';

describe('GetTeamSummariesHandler', () => {
  it('asks the read model for the owner’s summaries of exactly the requested ids', async () => {
    const summary = { id: 'team-1', name: 'Mobile', colorHex: '#7C3AED' };
    const summaries = jest.fn().mockResolvedValue([summary]);
    const handler = new GetTeamSummariesHandler({
      summaries,
    } as unknown as TeamReadModel);

    const result = await handler.execute(
      new GetTeamSummariesQuery('owner-1', ['team-1', 'team-2']),
    );

    expect(summaries).toHaveBeenCalledWith('owner-1', ['team-1', 'team-2']);
    expect(result).toEqual([summary]);
  });
});
