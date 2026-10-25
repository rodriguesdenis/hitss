import { http, HttpResponse } from 'msw';

import { act, getToken, queryClient, renderApp, screen } from '../app-harness';
import { API_URL } from '../fixtures';
import { MARINA_TOKEN } from '../handlers/auth';
import { server } from '../server';

it('AC-04.1.6 sends a 401 back to sign-in with the session-expired message', async () => {
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/tasks',
    fetchTeams: true,
  });
  expect(await screen.findByText('tasks screen')).toBeOnTheScreen();

  server.use(
    http.get(`${API_URL}/api/v1/teams`, () =>
      HttpResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'x', traceId: 't' } },
        { status: 401 },
      ),
    ),
  );
  const pausedChange = queryClient()
    .getMutationCache()
    .build(queryClient(), {
      mutationKey: ['tasks', 'changeStatus'],
      mutationFn: () => new Promise(() => undefined),
      gcTime: Infinity,
    });
  await act(() => queryClient().refetchQueries());

  expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();
  expect(
    screen.getByText('Sua sessão expirou. Entre novamente.'),
  ).toBeOnTheScreen();
  await expect(getToken()).resolves.toBeNull();
  expect(queryClient().getQueryCache().getAll()).toHaveLength(0);
  expect(queryClient().getMutationCache().getAll()).toEqual([pausedChange]);
});
