import AsyncStorage from '@react-native-async-storage/async-storage';
import { http, HttpResponse } from 'msw';

import SettingsRoute from '../../app/(tabs)/settings';

import { createMemoryStorage } from '@/lib/storage';

import { act, fireEvent, queryClient, renderApp, screen } from '../app-harness';
import { API_URL } from '../fixtures';
import { marina, MARINA_TOKEN } from '../handlers/auth';
import { setNetwork } from '../mocks/netinfo';
import { storedEntries } from '../mocks/secure-store';
import { server } from '../server';
import { queueStatusChange, withNetwork } from './session-helpers';

it('AC-05.6.6 warns before signing out with pending changes, keeps them on cancel and wipes them on confirm', async () => {
  const stop = withNetwork();
  const storage = createMemoryStorage();
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/settings',
    routes: { '(tabs)/settings': SettingsRoute },
    storage,
  });
  expect(await screen.findByText(marina.email)).toBeOnTheScreen();

  await act(async () => {
    setNetwork({ isConnected: false });
    server.use(http.patch(`${API_URL}/api/v1/*`, () => HttpResponse.error()));
    queueStatusChange();
    queueStatusChange();
  });
  expect(
    await screen.findByText('2 alterações aguardando sincronização'),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
  expect(
    screen.getByText(
      'Você tem 2 alterações não sincronizadas. Ao sair, elas serão descartadas.',
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByText(marina.email)).toBeOnTheScreen();
  expect(queryClient().getMutationCache().getAll()).toHaveLength(2);

  await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
  await fireEvent.press(
    screen.getByRole('button', { name: 'Sair mesmo assim' }),
  );
  expect(await screen.findByText('sign-in screen')).toBeOnTheScreen();

  expect(queryClient().getMutationCache().getAll()).toHaveLength(0);
  const values = await Promise.all(
    (await AsyncStorage.getAllKeys()).map((key) => AsyncStorage.getItem(key)),
  );
  expect(values.join(' ')).not.toContain(marina.id);
  await expect(storage.getItem(`rq:${marina.id}`)).resolves.toBeNull();
  expect(
    storedEntries().filter(
      ([, value]) => value.includes(marina.id) || value.includes(MARINA_TOKEN),
    ),
  ).toEqual([]);
  stop();
});
