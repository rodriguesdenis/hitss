import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import * as SecureStore from 'expo-secure-store';
import { delay, http, HttpResponse, passthrough } from 'msw';

import { authClient } from '@/features/auth';
import { mk } from '@/lib/query-keys';
import { createMemoryStorage } from '@/lib/storage';
import { useSyncStore } from '@/offline';
import { createOwnerPersister, persistOptions } from '@/offline/persister';

import { act, renderApp, screen, waitFor } from '../app-harness';
import { db } from '../db';
import { API_URL } from '../fixtures';
import { marina, MARINA_PASSWORD } from '../handlers/auth';
import { createTestQueryClient } from '../renderWithProviders';
import { server } from '../server';
import { crash, trackWrites, withNetwork } from './session-helpers';

it('AC-05.6.5 sends nothing after a restart with an expired session until the user signs in', async () => {
  const storage = createMemoryStorage();
  const before = createTestQueryClient();
  before.getMutationCache().build(
    before,
    { mutationKey: mk.tasks.changeStatus },
    {
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      submittedAt: Date.now(),
      status: 'pending',
      isPaused: true,
      variables: { ...crash, status: 'DONE' },
      context: { queued: true },
    },
  );
  useSyncStore.setState({ ownerId: marina.id });
  await persistQueryClientSave({
    queryClient: before,
    ...persistOptions(
      createOwnerPersister({
        storage,
        getOwnerId: () => marina.id,
        throttleTime: 0,
      }),
      'test',
    ),
  });
  before.clear();

  await SecureStore.setItemAsync(
    'teamstasks_session_data',
    JSON.stringify({
      session: {
        id: 's',
        userId: marina.id,
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
      user: marina,
    }),
  );

  server.use(
    http.get(`${API_URL}/api/auth/get-session`, async ({ request }) => {
      await delay(100);
      return request.headers.get('authorization') === 'Bearer tok_expired'
        ? HttpResponse.json(null)
        : passthrough();
    }),
  );
  const stop = withNetwork();
  const writes = trackWrites();
  await renderApp({ token: 'tok_expired', initialUrl: '/tasks', storage });
  expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();
  expect(writes).toEqual([]);

  server.resetHandlers();
  await act(async () => {
    await authClient.signIn.email({
      email: marina.email,
      password: MARINA_PASSWORD,
    });
  });
  await waitFor(() =>
    expect(db.tasks.find((t) => t.id === crash.id)?.status).toBe('DONE'),
  );
  expect(writes).toEqual([`PATCH /api/v1/tasks/${crash.id}/status`]);
  stop();
});
