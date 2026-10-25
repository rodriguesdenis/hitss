import { http, HttpResponse } from 'msw';

import SettingsRoute from '../../app/(tabs)/settings';

import { authClient } from '@/features/auth';
import { mk } from '@/lib/query-keys';
import { useSyncStore } from '@/offline';

import {
  act,
  fireEvent,
  queryClient,
  renderApp,
  screen,
  waitFor,
} from '../app-harness';
import { db } from '../db';
import { API_URL } from '../fixtures';
import { ana, ANA_PASSWORD, marina, MARINA_TOKEN } from '../handlers/auth';
import { server } from '../server';
import { crash, queueStatusChange, withNetwork } from './session-helpers';

it('AC-05.6.5 never sends a change sleeping in its backoff after its user signed out', async () => {
  const stop = withNetwork();
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/settings',
    routes: { '(tabs)/settings': SettingsRoute },
  });
  expect(await screen.findByText(marina.email)).toBeOnTheScreen();
  queryClient().setMutationDefaults(mk.tasks.changeStatus, {
    ...queryClient().getMutationDefaults(mk.tasks.changeStatus),
    retryDelay: 10_000,
  });

  const sent: string[] = [];
  server.use(
    http.patch(`${API_URL}/api/v1/tasks/:id/status`, ({ request }) => {
      sent.push(request.headers.get('authorization') ?? '');
      return HttpResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'x', traceId: 't' } },
        { status: 503 },
      );
    }),
  );
  await act(async () => {
    queueStatusChange();
  });
  await act(() => jest.advanceTimersByTimeAsync(100));
  expect(sent).toEqual([`Bearer ${MARINA_TOKEN}`]);

  await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
  await fireEvent.press(
    screen.getByRole('button', { name: 'Sair mesmo assim' }),
  );
  expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();

  server.resetHandlers();
  server.use(
    http.patch(`${API_URL}/api/v1/tasks/:id/status`, ({ request }) => {
      sent.push(request.headers.get('authorization') ?? '');
      return HttpResponse.json({
        data: db.tasks.find((t) => t.id === crash.id),
      });
    }),
  );
  await act(async () => {
    await authClient.signIn.email({ email: ana.email, password: ANA_PASSWORD });
  });
  await waitFor(() => expect(useSyncStore.getState().ownerId).toBe(ana.id));

  await act(() => jest.advanceTimersByTimeAsync(15_000));
  expect(sent).toEqual([`Bearer ${MARINA_TOKEN}`]);
  expect(db.tasks.find((t) => t.id === crash.id)?.status).toBe('PENDING');
  stop();
});
