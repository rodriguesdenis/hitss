import { renderApp, screen } from '../app-harness';
import { teamRoutes } from '../team-routes';

it.each(['/teams/new', '/teams/team-mobile/edit'])(
  'AC-04.1.1 sends a visitor deep-linking to %s to sign in',
  async (initialUrl) => {
    await renderApp({ initialUrl, routes: teamRoutes });
    expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();
    expect(screen.queryByText(/team screen/)).toBeNull();
  },
);
