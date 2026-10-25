import { Text } from 'react-native';

import TabsLayout from '../app/(tabs)/_layout';
import SettingsRoute from '../app/(tabs)/settings';

import { act, fireEvent, renderApp, screen, waitFor } from './app-harness';
import { marina, MARINA_TOKEN } from './handlers/auth';
import { testRouter } from 'expo-router/testing-library';

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/teams': () => <Text>teams screen</Text>,
  '(tabs)/settings': SettingsRoute,
};

describe('tab shell', () => {
  it('shows three labelled tabs', async () => {
    await renderApp({ token: MARINA_TOKEN, initialUrl: '/tasks', routes });
    expect(await screen.findByText('tasks screen')).toBeOnTheScreen();
    for (const label of ['Tarefas', 'Times', 'Ajustes']) {
      expect(
        screen.getByRole('button', { name: new RegExp(label) }),
      ).toBeOnTheScreen();
    }
  });

  it('shows the signed-in account on Settings', async () => {
    await renderApp({ token: MARINA_TOKEN, initialUrl: '/tasks', routes });
    await screen.findByText('tasks screen');
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    expect(await screen.findByText(marina.name)).toBeOnTheScreen();
    expect(screen.getByText(marina.email)).toBeOnTheScreen();
    expect(screen.getByText('Conta')).toBeOnTheScreen();
  });

  it('goes back through tab history', async () => {
    await renderApp({ token: MARINA_TOKEN, initialUrl: '/tasks', routes });
    await screen.findByText('tasks screen');
    await fireEvent.press(screen.getByRole('button', { name: /Times/ }));
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await screen.findByText(marina.name);
    expect(screen).toHavePathname('/settings');
    await act(() => testRouter.back());
    await waitFor(() => expect(screen).toHavePathname('/teams'));
  });
});
