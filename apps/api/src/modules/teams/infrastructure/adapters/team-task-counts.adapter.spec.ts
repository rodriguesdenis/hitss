import { QueryBus } from '@nestjs/cqrs';
import { CountTasksByTeamQuery } from '../../../tasks/contracts/count-tasks-by-team.query';
import { QueryBusTeamTaskCounts } from './team-task-counts.adapter';

describe('QueryBusTeamTaskCounts', () => {
  const execute = jest.fn();
  const counts = new QueryBusTeamTaskCounts({ execute } as unknown as QueryBus);

  beforeEach(() => execute.mockReset());

  it('AC-02.8.1 asks Task Management once, through the contract query, for the distinct ids', async () => {
    execute.mockResolvedValue(new Map([['a', 3]]));

    const result = await counts.countByTeam('owner-1', ['a', 'b', 'a']);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      new CountTasksByTeamQuery('owner-1', ['a', 'b']),
    );
    // Every requested id is answered, 0 when Task Management has none.
    expect([...result]).toEqual([
      ['a', 3],
      ['b', 0],
    ]);
  });

  it('sends nothing for no ids', async () => {
    expect((await counts.countByTeam('owner-1', [])).size).toBe(0);
    expect(execute).not.toHaveBeenCalled();
  });
});
