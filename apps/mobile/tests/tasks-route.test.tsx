import { Text } from 'react-native';

import TabsLayout from '../app/(tabs)/_layout';
import TasksRoute from '../app/(tabs)/tasks';

import { fireEvent, renderApp, screen } from './app-harness';
import { MARINA_TOKEN } from './handlers/auth';

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/tasks': TasksRoute,
  '(tabs)/teams': () => <Text>teams screen</Text>,
  '(tabs)/settings': () => <Text>settings screen</Text>,
};

describe('tasks route header', () => {
  it('AC-04.2.2 is titled with the team name and goes back to all tasks', async () => {
    await renderApp({
      token: MARINA_TOKEN,
      initialUrl: '/tasks?teamId=team-mobile',
      routes,
    });
    expect(
      await screen.findByRole('heading', { name: 'Mobile' }),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para todas as tarefas' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Tarefas' }),
    ).toBeOnTheScreen();
    expect(screen).toHavePathname('/tasks');
    expect(screen).toHaveSearchParams({});
    expect(screen.getByPlaceholderText('Buscar tarefas')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Voltar para todas as tarefas' }),
    ).toBeNull();
  });

  it('shows the plain tab title on the global list', async () => {
    await renderApp({ token: MARINA_TOKEN, initialUrl: '/tasks', routes });
    expect(
      await screen.findByRole('heading', { name: 'Tarefas' }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Voltar para todas as tarefas' }),
    ).toBeNull();
  });
});
