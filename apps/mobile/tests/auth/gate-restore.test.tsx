import { renderApp, screen } from '../app-harness';
import { MARINA_TOKEN } from '../handlers/auth';

it('AC-04.1.1 restores the session from the stored token on launch', async () => {
  await renderApp({ token: MARINA_TOKEN, initialUrl: '/' });
  expect(await screen.findByText('tasks screen')).toBeOnTheScreen();
  expect(screen.queryByText('sign-in screen')).toBeNull();
});
