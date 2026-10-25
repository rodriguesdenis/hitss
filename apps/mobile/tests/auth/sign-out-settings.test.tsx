import SettingsRoute from '../../app/(tabs)/settings';

import {
  fireEvent,
  getToken,
  queryClient,
  renderApp,
  screen,
} from '../app-harness';
import { marina, MARINA_TOKEN } from '../handlers/auth';

it('AC-04.16.1 signs out from Settings and starts over on sign-in', async () => {
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/settings',
    fetchTeams: true,
    routes: { '(tabs)/settings': SettingsRoute },
  });
  expect(await screen.findByText(marina.email)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));

  expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();
  await expect(getToken()).resolves.toBeNull();
  expect(queryClient().getQueryCache().getAll()).toHaveLength(0);
});
