import { TeamDeleted as DomainTeamDeleted } from '../domain/team.events';
import { TeamDeleted } from './team-deleted.event';

describe('TeamDeleted contract', () => {
  it('AC-02.7.2 is the domain class itself, so in-transaction handlers registered on it receive the event', () => {
    expect(TeamDeleted).toBe(DomainTeamDeleted);
    expect(new DomainTeamDeleted('t', 'o', new Date()).constructor).toBe(
      TeamDeleted,
    );
  });
});
