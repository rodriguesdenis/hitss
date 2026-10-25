import { dehydrate, QueryClient, useQueryClient } from '@tanstack/react-query';
import { Text } from 'react-native';

import { createMemoryStorage } from '@/lib/storage';
import { qk } from '@/lib/query-keys';
import { useSyncStore } from '@/offline';
import { cacheKey } from '@/offline/persister';

import { renderApp, screen } from '../app-harness';
import { MARINA_TOKEN } from '../handlers/auth';

const listKey = qk.teams.list({ limit: 20, sort: 'name' });

async function seed(ownerId: string, teamName: string) {
  const storage = createMemoryStorage();
  const client = new QueryClient();
  client.setQueryData(listKey, { data: [{ id: 't', name: teamName }] });
  await storage.setItem(
    cacheKey(ownerId),
    JSON.stringify({
      timestamp: Date.now(),
      buster: 'test',
      clientState: dehydrate(client),
    }),
  );
  client.clear();
  useSyncStore.setState({ ownerId });
  return storage;
}

function CachedTeams() {
  const data = useQueryClient().getQueryData<{ data: { name: string }[] }>(
    listKey,
  );
  return (
    <Text>{`cached: ${data?.data.map((t) => t.name).join(', ') ?? 'none'}`}</Text>
  );
}

const routes = { '(tabs)/tasks': CachedTeams };

it('AC-05.1.1 shows the same user’s saved lists after a restart', async () => {
  const storage = await seed('user-marina', 'Marina team');
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/tasks',
    routes,
    storage,
  });
  expect(await screen.findByText('cached: Marina team')).toBeOnTheScreen();
});

it('AC-05.1.5 discards another user’s saved data before showing the app', async () => {
  const storage = await seed('user-ana', 'Ana team');
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/tasks',
    routes,
    storage,
  });
  expect(await screen.findByText('cached: none')).toBeOnTheScreen();
  expect(screen.queryByText(/Ana team/)).toBeNull();
  await expect(storage.getItem(cacheKey('user-ana'))).resolves.toBeNull();
  expect(useSyncStore.getState().ownerId).toBe('user-marina');
});
