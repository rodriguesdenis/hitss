import { http, HttpResponse } from 'msw';

import { authClient } from '@/features/auth';

import { act, queryClient, renderApp, screen, waitFor } from '../app-harness';
import { db } from '../db';
import { API_URL } from '../fixtures';
import { marina, MARINA_PASSWORD, MARINA_TOKEN } from '../handlers/auth';
import { setNetwork } from '../mocks/netinfo';
import { server } from '../server';
import {
  crash,
  queueStatusChange,
  trackWrites,
  withNetwork,
} from './session-helpers';

it('AC-05.6.5 keeps a change through an expired session and sends it after the same user signs in', async () => {
  const stop = withNetwork();
  const writes = trackWrites();
  await renderApp({ token: MARINA_TOKEN, initialUrl: '/tasks' });
  await screen.findByText('tasks screen');

  await act(async () => {
    setNetwork({ isConnected: false });
    server.use(http.patch(`${API_URL}/api/v1/*`, () => HttpResponse.error()));
    queueStatusChange();
  });
  server.resetHandlers();
  server.use(
    http.patch(`${API_URL}/api/v1/tasks/:id/status`, () =>
      HttpResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'x', traceId: 't' } },
        { status: 401 },
      ),
    ),
    http.get(`${API_URL}/api/auth/get-session`, () => HttpResponse.json(null)),
  );
  await act(async () => setNetwork({ isConnected: true }));
  await waitFor(() =>
    expect(writes).toContain(`PATCH /api/v1/tasks/${crash.id}/status`),
  );
  expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();
  expect(queryClient().getMutationCache().getAll()).toHaveLength(1);
  expect(queryClient().getQueryCache().getAll()).toHaveLength(0);

  server.resetHandlers();
  await act(async () => {
    await authClient.signIn.email({
      email: marina.email,
      password: MARINA_PASSWORD,
    });
  });
  expect(await screen.findByText('tasks screen')).toBeOnTheScreen();
  await waitFor(() =>
    expect(db.tasks.find((t) => t.id === crash.id)?.status).toBe('DONE'),
  );
  stop();
  server.events.removeAllListeners();
});
