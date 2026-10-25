import { renderApp, screen } from '../app-harness';
import { MARINA_TOKEN } from '../handlers/auth';
import { taskRoutes } from '../task-routes';

it('AC-04.1.1 opens /tasks/task-login for a signed-in user', async () => {
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/tasks/task-login',
    routes: taskRoutes,
  });
  expect(await screen.findByText('task detail screen')).toBeOnTheScreen();
  expect(screen.queryByText('sign-in screen')).toBeNull();
});
