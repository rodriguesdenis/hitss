import { renderApp, screen } from '../app-harness';
import { taskRoutes } from '../task-routes';

it.each(['/tasks/new', '/tasks/task-login', '/tasks/task-login/edit'])(
  'AC-04.1.1 sends a visitor deep-linking to %s to sign in',
  async (initialUrl) => {
    await renderApp({ initialUrl, routes: taskRoutes });
    expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();
    expect(screen.queryByText(/task screen|task detail/)).toBeNull();
  },
);
