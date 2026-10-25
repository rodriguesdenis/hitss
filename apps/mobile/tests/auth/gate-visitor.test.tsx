import { renderApp, screen } from '../app-harness';

it('AC-04.1.1 keeps a visitor on the sign-in screen', async () => {
  await renderApp({ initialUrl: '/tasks' });
  expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();
  expect(screen.queryByText('tasks screen')).toBeNull();
});
