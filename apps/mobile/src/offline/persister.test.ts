import { tasksList, teamsList } from '@hitss/api-client';
import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { http, HttpResponse } from 'msw';

import { createMemoryStorage, type StorageAdapter } from '@/lib/storage';
import { qk } from '@/lib/query-keys';

import { API_URL } from '../../tests/fixtures';
import { MARINA_TOKEN } from '../../tests/handlers/auth';
import { server } from '../../tests/server';
import {
  CACHE_MAX_AGE,
  cacheKey,
  createOwnerPersister,
  persistOptions,
} from './persister';

const BUSTER = '1.0.0:abc:1';

const clients: QueryClient[] = [];

function newClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: CACHE_MAX_AGE, retry: false, staleTime: Infinity },
    },
  });
  clients.push(client);
  return client;
}

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

async function save(storage: StorageAdapter, ownerId: string, buster = BUSTER) {
  const client = newClient();
  await client.fetchQuery({
    queryKey: qk.teams.list({ limit: 20 }),
    queryFn: () => teamsList({ limit: 20 }),
  });
  await client.fetchQuery({
    queryKey: qk.tasks.list({ limit: 20 }),
    queryFn: () => tasksList({ limit: 20 }),
  });
  client.setQueryData(['/api/auth/get-session'], {
    session: { token: MARINA_TOKEN },
  });
  const persister = createOwnerPersister({
    storage,
    getOwnerId: () => ownerId,
    throttleTime: 0,
  });
  await persistQueryClientSave({
    queryClient: client,
    ...persistOptions(persister, buster),
  });
}

async function restore(
  storage: StorageAdapter,
  ownerId: string,
  buster = BUSTER,
) {
  const client = newClient();
  const persister = createOwnerPersister({
    storage,
    getOwnerId: () => ownerId,
    throttleTime: 0,
  });
  await persistQueryClientRestore({
    queryClient: client,
    ...persistOptions(persister, buster),
  });
  return client;
}

function offline() {
  server.use(http.get(`${API_URL}/api/v1/*`, () => HttpResponse.error()));
}

describe('persisted query cache', () => {
  it('AC-05.1.1 restores the last lists in a new client without the network', async () => {
    const storage = createMemoryStorage();
    await save(storage, 'user-marina');
    offline();
    const client = await restore(storage, 'user-marina');
    expect(client.getQueryData(qk.teams.list({ limit: 20 }))).toMatchObject({
      data: [{ name: 'Backend' }, { name: 'Design' }, { name: 'Mobile' }],
    });
    expect(client.getQueryData(qk.tasks.list({ limit: 20 }))).toMatchObject({
      meta: { total: 4 },
    });
  });

  it('AC-05.1.4 discards a snapshot older than 24 hours', async () => {
    const storage = createMemoryStorage();
    await save(storage, 'user-marina');
    const stored = JSON.parse(
      (await storage.getItem(cacheKey('user-marina')))!,
    );
    stored.timestamp = Date.now() - 25 * 60 * 60 * 1000;
    await storage.setItem(cacheKey('user-marina'), JSON.stringify(stored));
    const client = await restore(storage, 'user-marina');
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    await expect(storage.getItem(cacheKey('user-marina'))).resolves.toBeNull();
  });

  it('AC-05.1.4 discards a snapshot from an incompatible app version', async () => {
    const storage = createMemoryStorage();
    await save(storage, 'user-marina', '0.9.0:old:1');
    const client = await restore(storage, 'user-marina');
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('AC-05.1.5 never restores another user’s data', async () => {
    const storage = createMemoryStorage();
    await save(storage, 'user-marina');
    const client = await restore(storage, 'user-ana');
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('persists no auth data and no token', async () => {
    const storage = createMemoryStorage();
    await save(storage, 'user-marina');
    const raw = (await storage.getItem(cacheKey('user-marina')))!;
    expect(raw).not.toContain(MARINA_TOKEN);
    expect(raw).not.toContain('/api/auth');
    const keys = JSON.parse(raw).clientState.queries.map(
      (q: { queryKey: unknown[] }) => q.queryKey[0],
    );
    expect([...new Set(keys)].sort()).toEqual(['tasks', 'teams']);
  });

  it('persists nothing without an owner', async () => {
    const storage = createMemoryStorage();
    const client = newClient();
    client.setQueryData(qk.teams.list({}), { data: [] });
    const persister = createOwnerPersister({
      storage,
      getOwnerId: () => null,
      throttleTime: 0,
    });
    await persistQueryClientSave({
      queryClient: client,
      ...persistOptions(persister, BUSTER),
    });
    await expect(storage.getItem(cacheKey('null'))).resolves.toBeNull();
  });
});

describe('owner persister writes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const snapshot = (name: string) =>
    ({
      timestamp: 1,
      buster: BUSTER,
      clientState: { queries: [], mutations: [], name },
    }) as never;

  it('writes the latest snapshot once per throttle window', async () => {
    const storage = createMemoryStorage();
    const persister = createOwnerPersister({
      storage,
      getOwnerId: () => 'u1',
      throttleTime: 1000,
    });
    await persister.persistClient(snapshot('a'));
    await persister.persistClient(snapshot('b'));
    await jest.advanceTimersByTimeAsync(1000);
    expect(
      JSON.parse((await storage.getItem(cacheKey('u1')))!).clientState.name,
    ).toBe('b');
  });

  it('drops a pending write when the cache is removed', async () => {
    const storage = createMemoryStorage();
    const persister = createOwnerPersister({
      storage,
      getOwnerId: () => 'u1',
      throttleTime: 1000,
    });
    await persister.persistClient(snapshot('a'));
    await persister.removeClient();
    await jest.advanceTimersByTimeAsync(1000);
    await expect(storage.getItem(cacheKey('u1'))).resolves.toBeNull();
  });

  it('keeps a pending write under the owner it was taken for', async () => {
    const storage = createMemoryStorage();
    let owner = 'user-marina';
    const persister = createOwnerPersister({
      storage,
      getOwnerId: () => owner,
      throttleTime: 1000,
    });
    await persister.persistClient(snapshot('marina'));
    owner = 'user-ana';
    await jest.advanceTimersByTimeAsync(1000);
    await expect(storage.getItem(cacheKey('user-ana'))).resolves.toBeNull();
    expect(
      JSON.parse((await storage.getItem(cacheKey('user-marina')))!).clientState
        .name,
    ).toBe('marina');
  });
});
