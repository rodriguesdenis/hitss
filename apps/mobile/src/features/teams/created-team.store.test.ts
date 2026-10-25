import { resetSessionState } from '@/lib/session-reset';

import { offerCreatedTeam, useCreatedTeamStore } from './created-team.store';

it('forgets an offered team on sign-out', async () => {
  offerCreatedTeam('team-x');
  expect(useCreatedTeamStore.getState().teamId).toBe('team-x');
  await resetSessionState();
  expect(useCreatedTeamStore.getState().teamId).toBeUndefined();
});
