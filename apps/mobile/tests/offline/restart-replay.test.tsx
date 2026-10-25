import type { TaskResponseDto, TasksList200 } from '@hitss/api-client';
import type { InfiniteData } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { Text } from 'react-native';

import TabsLayout from '../../app/(tabs)/_layout';

import type {
  TaskCreateVars,
  TaskDeleteVars,
  TaskStatusVars,
} from '@/features/tasks';
import { mk, qk } from '@/lib/query-keys';
import { createMemoryStorage } from '@/lib/storage';
import { newTempId } from '@/offline';

import { act, queryClient, renderApp, screen, waitFor } from '../app-harness';
import { db } from '../db';
import { API_URL } from '../fixtures';
import { MARINA_TOKEN } from '../handlers/auth';
import { setNetwork } from '../mocks/netinfo';
import { server } from '../server';
import { trackWrites, withNetwork } from './session-helpers';

const params = { limit: 20 };

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/tasks': () => <Text>tasks screen</Text>,
};

const pendingKeys = () =>
  queryClient()
    .getMutationCache()
    .getAll()
    .filter((m) => m.state.status === 'pending')
    .map((m) => m.options.mutationKey?.[1]);

const cachedTasks = () =>
  (
    queryClient().getQueryData<InfiniteData<TasksList200>>(
      qk.tasks.list(params),
    )?.pages ?? []
  )
    .flatMap((page) => page.data)
    .map((task: TaskResponseDto) => `${task.title}:${task.status}`);

function run<T>(key: readonly unknown[], variables: T) {
  void queryClient()
    .getMutationCache()
    .build(queryClient(), { mutationKey: key })
    .execute(variables)
    .catch(() => undefined);
}

it('AC-05.6.1 AC-05.6.2 AC-05.2.3 keeps offline changes across a restart and replays them in order', async () => {
  const stop = withNetwork();
  const storage = createMemoryStorage();
  const first = await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/tasks',
    routes,
    storage,
  });
  expect(await screen.findByText('tasks screen')).toBeOnTheScreen();
  await act(async () => {
    queryClient().setQueryData(qk.tasks.list(params), {
      pages: [
        {
          data: db.tasks,
          meta: {
            total: db.tasks.length,
            limit: 20,
            offset: 0,
            hasNextPage: false,
          },
        },
      ],
      pageParams: [0],
    });
  });

  await act(async () => {
    setNetwork({ isConnected: false });
    server.use(
      http.post(`${API_URL}/api/v1/*`, () => HttpResponse.error()),
      http.patch(`${API_URL}/api/v1/*`, () => HttpResponse.error()),
      http.delete(`${API_URL}/api/v1/*`, () => HttpResponse.error()),
    );
    run<TaskCreateVars>(mk.tasks.create, {
      tempId: newTempId(),
      body: { title: 'Write release notes' },
    });
    run<TaskStatusVars>(mk.tasks.changeStatus, {
      id: 'task-crash',
      title: 'Fix crash on Android',
      status: 'DONE',
    });
    run<TaskDeleteVars>(mk.tasks.delete, {
      id: 'task-deps',
      title: 'Update dependencies',
    });
  });
  expect(pendingKeys()).toEqual(['create', 'changeStatus', 'delete']);
  await waitFor(async () =>
    expect(await storage.getItem('rq:user-marina')).toContain(
      'Write release notes',
    ),
  );
  first.unmount();
  queryClient().unmount();

  server.resetHandlers();
  server.use(
    http.post(`${API_URL}/api/v1/*`, () => HttpResponse.error()),
    http.patch(`${API_URL}/api/v1/*`, () => HttpResponse.error()),
    http.delete(`${API_URL}/api/v1/*`, () => HttpResponse.error()),
  );
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/tasks',
    routes,
    storage,
  });
  expect(await screen.findByText('tasks screen')).toBeOnTheScreen();
  expect(pendingKeys()).toEqual(['create', 'changeStatus', 'delete']);
  expect(cachedTasks()[0]).toBe('Write release notes:PENDING');
  expect(cachedTasks()).toContain('Fix crash on Android:DONE');
  expect(cachedTasks().join()).not.toContain('Update dependencies');

  await act(() => jest.advanceTimersByTimeAsync(1500));
  server.resetHandlers();
  const writes = trackWrites();
  await act(async () => setNetwork({ isConnected: true }));
  await waitFor(() => expect(writes).toHaveLength(3));
  expect(writes).toEqual([
    'POST /api/v1/tasks',
    'PATCH /api/v1/tasks/task-crash/status',
    'DELETE /api/v1/tasks/task-deps',
  ]);
  expect(
    await screen.findByText('Todas as alterações sincronizadas'),
  ).toBeOnTheScreen();
  expect(db.tasks.find((t) => t.title === 'Write release notes')).toBeDefined();
  expect(db.tasks.find((t) => t.id === 'task-crash')?.status).toBe('DONE');
  expect(db.tasks.some((t) => t.id === 'task-deps')).toBe(false);
  stop();
  server.events.removeAllListeners();
});
