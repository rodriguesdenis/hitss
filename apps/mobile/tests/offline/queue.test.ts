import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { http, HttpResponse } from 'msw';

import {
  registerTaskMutationDefaults,
  type TaskCreateVars,
  type TaskStatusVars,
} from '@/features/tasks';
import {
  registerTeamMutationDefaults,
  type TeamCreateVars,
  type TeamUpdateVars,
} from '@/features/teams';
import { createQueryClient } from '@/lib/query-client';
import { mk } from '@/lib/query-keys';
import { createMemoryStorage } from '@/lib/storage';
import { newTempId, setSyncAllowed, useSyncStore } from '@/offline';
import { startNetwork } from '@/offline/network';
import { createOwnerPersister, persistOptions } from '@/offline/persister';

import { API_URL, tasks } from '../fixtures';
import { setNetwork } from '../mocks/netinfo';
import { server } from '../server';

type Sent = { method: string; path: string; body?: unknown };

let sent: Sent[] = [];
let failNext: { status: number; headers?: Record<string, string> }[] = [];
let offlineServer = false;
const stops: (() => void)[] = [];
const clients: QueryClient[] = [];

function api() {
  const respond = async (
    request: Request,
    body: (input: unknown) => unknown,
    status = 200,
  ) => {
    const input =
      request.method === 'DELETE'
        ? undefined
        : await request
            .clone()
            .json()
            .catch(() => undefined);
    if (offlineServer) {
      return HttpResponse.error();
    }
    sent.push({
      method: request.method,
      path: new URL(request.url).pathname,
      ...(input ? { body: input } : {}),
    });
    const failure = failNext.shift();
    if (failure) {
      return HttpResponse.json(
        {
          error: {
            code: failure.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR',
            message: 'x',
            traceId: 't',
          },
        },
        { status: failure.status, headers: failure.headers },
      );
    }
    return HttpResponse.json(body(input) as Record<string, unknown>, {
      status,
    });
  };
  server.use(
    http.post(`${API_URL}/api/v1/teams`, ({ request }) =>
      respond(
        request,
        (input) => ({
          data: { ...(input as object), id: 'team-platform', taskCount: 0 },
        }),
        201,
      ),
    ),
    http.put(`${API_URL}/api/v1/teams/:id`, ({ request, params }) =>
      respond(request, (input) => ({
        data: { ...(input as object), id: params.id },
      })),
    ),
    http.post(`${API_URL}/api/v1/tasks`, ({ request }) =>
      respond(
        request,
        (input) => ({
          data: { ...(input as object), id: 'task-new', teams: [] },
        }),
        201,
      ),
    ),
    http.patch(`${API_URL}/api/v1/tasks/:id/status`, ({ request, params }) =>
      respond(request, (input) => ({
        data: {
          ...tasks.find((t) => t.id === params.id),
          ...(input as object),
        },
      })),
    ),
  );
}

function newClient() {
  const client = createQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { ...client.getDefaultOptions().mutations, gcTime: 0 },
  });
  registerTeamMutationDefaults(client);
  registerTaskMutationDefaults(client);
  client.mount();
  clients.push(client);
  return client;
}

beforeEach(() => {
  sent = [];
  failNext = [];
  offlineServer = false;
  useSyncStore.setState({
    ownerId: 'user-marina',
    idMap: {},
    failedTmpIds: [],
  });
  stops.push(startNetwork());
  setSyncAllowed(true);
  api();
});

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  clients.splice(0).forEach((client) => {
    client.unmount();
    client.clear();
  });
  setSyncAllowed(false);
  jest.useRealTimers();
});

function mutate<T>(client: QueryClient, key: readonly unknown[], variables: T) {
  return client
    .getMutationCache()
    .build(client, { mutationKey: key })
    .execute(variables)
    .catch(() => undefined);
}

describe('durable mutation queue', () => {
  it('AC-05.6.2 replays changes made offline after a restart, in order, with real ids', async () => {
    jest.useFakeTimers();
    const storage = createMemoryStorage();
    const before = newClient();
    setNetwork({ isConnected: false });
    offlineServer = true;

    const teamTempId = newTempId();
    void mutate<TeamCreateVars>(before, mk.teams.create, {
      tempId: teamTempId,
      body: { name: 'Platform', colorHex: '#3B82F6' },
    });
    void mutate<TaskCreateVars>(before, mk.tasks.create, {
      tempId: newTempId(),
      body: { title: 'Set up CI', teamIds: [teamTempId] },
    });
    void mutate<TaskStatusVars>(before, mk.tasks.changeStatus, {
      id: 'task-crash',
      status: 'DONE',
      title: 'Fix crash on Android',
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(
      before
        .getMutationCache()
        .getAll()
        .map((m) => m.state.isPaused),
    ).toEqual([true, true, true]);

    const persister = createOwnerPersister({
      storage,
      getOwnerId: () => 'user-marina',
      throttleTime: 0,
    });
    await persistQueryClientSave({
      queryClient: before,
      ...persistOptions(persister, 'test'),
    });
    before.unmount();
    before.getMutationCache().clear();

    const after = newClient();
    await persistQueryClientRestore({
      queryClient: after,
      ...persistOptions(persister, 'test'),
    });
    expect(after.getMutationCache().getAll()).toHaveLength(3);

    offlineServer = false;
    setNetwork({ isConnected: true });
    await jest.advanceTimersByTimeAsync(0);
    await after.resumePausedMutations();

    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/v1/teams',
        body: { name: 'Platform', colorHex: '#3B82F6' },
      },
      {
        method: 'POST',
        path: '/api/v1/tasks',
        body: { title: 'Set up CI', teamIds: ['team-platform'] },
      },
      {
        method: 'PATCH',
        path: '/api/v1/tasks/task-crash/status',
        body: { status: 'DONE' },
      },
    ]);
    expect(JSON.stringify(sent)).not.toContain('tmp-');
  });

  it('AC-05.6.4 retries a temporary server failure with backoff', async () => {
    jest.useFakeTimers();
    const client = newClient();
    failNext = [{ status: 503 }, { status: 503 }];
    const done = mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      id: 'task-crash',
      status: 'DONE',
      title: 'Fix crash on Android',
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(999);
    expect(sent).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1999);
    expect(sent).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(3);
    await expect(done).resolves.toMatchObject({ data: { status: 'DONE' } });
  });

  it('AC-05.6.4 waits Retry-After on 429', async () => {
    jest.useFakeTimers();
    const client = newClient();
    failNext = [{ status: 429, headers: { 'Retry-After': '7' } }];
    void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      id: 'task-crash',
      status: 'DONE',
      title: 'Fix crash on Android',
    });
    await jest.advanceTimersByTimeAsync(6999);
    expect(sent).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(2);
  });

  it('resending a PUT ends in the same server state', async () => {
    const client = newClient();
    const body = { name: 'Backend', colorHex: '#0EA5E9', description: null };
    await mutate<TeamUpdateVars>(client, mk.teams.update, {
      id: 'team-backend',
      body,
    });
    await mutate<TeamUpdateVars>(client, mk.teams.update, {
      id: 'team-backend',
      body,
    });
    expect(sent).toEqual([
      { method: 'PUT', path: '/api/v1/teams/team-backend', body },
      { method: 'PUT', path: '/api/v1/teams/team-backend', body },
    ]);
  });
});
