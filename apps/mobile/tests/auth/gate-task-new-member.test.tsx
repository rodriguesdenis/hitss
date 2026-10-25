import { renderApp, screen } from '../app-harness';
import { MARINA_TOKEN } from '../handlers/auth';
import { taskRoutes } from '../task-routes';

it('AC-04.1.1 opens /tasks/new for a signed-in user', async () => {
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/tasks/new',
    routes: taskRoutes,
  });
  expect(await screen.findByText('new task screen')).toBeOnTheScreen();
  expect(screen.queryByText('sign-in screen')).toBeNull();
});
