import { act, screen } from '@testing-library/react-native';

import { TaskDetailScreen, type TaskCreateVars } from '@/features/tasks';
import { mk, qk } from '@/lib/query-keys';
import { newTempId, useSyncStore } from '@/offline';

import { db } from '../db';
import { renderWithProviders } from '../renderWithProviders';
import { server } from '../server';
import {
  goOffline,
  goOnline,
  mutate,
  newClient,
  seedTasks,
  settle,
  setupOffline,
  writes,
} from './harness';

setupOffline();

it('AC-05.5.1 keeps a detail opened on a temporary id working after the creation is confirmed', async () => {
  const urls: string[] = [];
  server.events.on('request:start', ({ request }) => {
    urls.push(request.url);
  });
  const client = newClient();
  await seedTasks(client, { limit: 20 });
  goOffline();
  const tempId = newTempId();
  void mutate<TaskCreateVars>(client, mk.tasks.create, {
    tempId,
    body: { title: 'Write release notes' },
  });
  await settle();
  await client.invalidateQueries({
    queryKey: qk.tasks.detail(tempId),
    refetchType: 'none',
  });

  await renderWithProviders(
    <TaskDetailScreen
      taskId={tempId}
      onBack={jest.fn()}
      onEdit={jest.fn()}
      onOpenTeam={jest.fn()}
      onDeleted={jest.fn()}
    />,
    { queryClient: client },
  );
  expect(
    await screen.findByRole('header', { name: 'Write release notes' }),
  ).toBeOnTheScreen();

  await act(() => goOnline(client));
  const realId = useSyncStore.getState().idMap[tempId];
  expect(db.tasks.some((task) => task.id === realId)).toBe(true);
  expect(
    screen.getByRole('header', { name: 'Write release notes' }),
  ).toBeOnTheScreen();
  expect(writes.join(' ')).not.toContain('tmp-');
  expect(urls.filter((url) => url.includes('tmp-'))).toEqual([]);
});
