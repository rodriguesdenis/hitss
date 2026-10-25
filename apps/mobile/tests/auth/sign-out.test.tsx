import * as SecureStore from 'expo-secure-store';

import { onSessionReset } from '@/lib/session-reset';

import {
  act,
  fireEvent,
  getToken,
  queryClient,
  renderApp,
  screen,
  waitFor,
} from '../app-harness';
import { MARINA_TOKEN } from '../handlers/auth';
import { storedKeys } from '../mocks/secure-store';
import { server } from '../server';

it('AC-04.16.1 wipes the token, the cache and local stores before leaving for sign-in', async () => {
  const resetFilters = jest.fn();
  onSessionReset(resetFilters);
  const signOutCalls: string[] = [];
  server.events.on('request:start', ({ request }) => {
    if (request.url.endsWith('/api/auth/sign-out')) {
      signOutCalls.push(request.headers.get('authorization') ?? '');
    }
  });

  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/tasks',
    fetchTeams: true,
  });
  expect(await screen.findByText('tasks screen')).toBeOnTheScreen();

  let release: () => void = () => undefined;
  const storageRemoved = new Promise<void>((resolve) => {
    release = resolve;
  });
  const deleteItem = jest.mocked(SecureStore.deleteItemAsync);
  const original = deleteItem.getMockImplementation()!;
  deleteItem.mockImplementation(async (key) => {
    await storageRemoved;
    await original(key);
  });

  await fireEvent.press(screen.getByText('Sair'));
  await waitFor(() => expect(deleteItem).toHaveBeenCalled());
  expect(screen.getByText('tasks screen')).toBeOnTheScreen();

  await act(async () => {
    release();
  });

  expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();
  expect(signOutCalls).toEqual([`Bearer ${MARINA_TOKEN}`]);
  await expect(getToken()).resolves.toBeNull();
  expect(storedKeys().filter((key) => key.startsWith('teamstasks.'))).toEqual(
    [],
  );
  expect(queryClient().getQueryCache().getAll()).toHaveLength(0);
  expect(resetFilters).toHaveBeenCalledTimes(1);
  server.events.removeAllListeners();
});
