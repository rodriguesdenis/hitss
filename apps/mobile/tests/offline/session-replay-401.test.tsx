import { http, HttpResponse } from 'msw';

import { authClient } from '@/features/auth';

import {
  act,
  getToken,
  queryClient,
  renderApp,
  screen,
  waitFor,
} from '../app-harness';
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

it('AC-05.6.5 pauses the queue on a 401 during replay and resumes after signing in again', async () => {
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
    http.patch(
      `${API_URL}/api/v1/tasks/:id/status`,
      () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'x', traceId: 't' } },
          { status: 401 },
        ),
      { once: true },
    ),
  );
  writes.length = 0;
  await act(async () => setNetwork({ isConnected: true }));

  expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();
  expect(writes).toEqual([`PATCH /api/v1/tasks/${crash.id}/status`]);
  await expect(getToken()).resolves.toBeNull();
  expect(queryClient().getMutationCache().getAll()[0]?.state.isPaused).toBe(
    true,
  );
  expect(db.tasks.find((t) => t.id === crash.id)?.status).toBe('PENDING');

  await act(async () => {
    await authClient.signIn.email({
      email: marina.email,
      password: MARINA_PASSWORD,
    });
  });
  await waitFor(() =>
    expect(db.tasks.find((t) => t.id === crash.id)?.status).toBe('DONE'),
  );
  stop();
  server.events.removeAllListeners();
});
