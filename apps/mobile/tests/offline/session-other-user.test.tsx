import { http, HttpResponse } from 'msw';

import { authClient } from '@/features/auth';
import { useSyncStore } from '@/offline';

import { act, queryClient, renderApp, screen, waitFor } from '../app-harness';
import { db } from '../db';
import { API_URL } from '../fixtures';
import { ana, ANA_PASSWORD, MARINA_TOKEN } from '../handlers/auth';
import { setNetwork } from '../mocks/netinfo';
import { server } from '../server';
import {
  crash,
  queueStatusChange,
  trackWrites,
  withNetwork,
} from './session-helpers';

it('AC-05.6.5 discards a queued change before another user signs in, never sending it', async () => {
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
  expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();
  await waitFor(() =>
    expect(queryClient().getMutationCache().getAll()).toHaveLength(1),
  );

  server.resetHandlers();
  writes.length = 0;
  await act(async () => {
    await authClient.signIn.email({ email: ana.email, password: ANA_PASSWORD });
  });
  expect(await screen.findByText('tasks screen')).toBeOnTheScreen();
  await waitFor(() => expect(useSyncStore.getState().ownerId).toBe(ana.id));
  expect(queryClient().getMutationCache().getAll()).toHaveLength(0);
  expect(writes).toEqual([]);
  expect(db.tasks.find((t) => t.id === crash.id)?.status).toBe('PENDING');
  stop();
  server.events.removeAllListeners();
});
