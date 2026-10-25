import { renderApp, screen } from '../app-harness';
import { MARINA_TOKEN } from '../handlers/auth';
import { teamRoutes } from '../team-routes';

it('AC-04.1.1 opens /teams/team-mobile/edit for a signed-in user', async () => {
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/teams/team-mobile/edit',
    routes: teamRoutes,
  });
  expect(await screen.findByText('edit team screen')).toBeOnTheScreen();
  expect(screen.queryByText('sign-in screen')).toBeNull();
});
