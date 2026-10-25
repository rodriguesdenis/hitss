import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

import { TaskDetailScreen, type TaskCreateVars } from '@/features/tasks';
import { mk, qk } from '@/lib/query-keys';
import { newTempId, useSyncStore } from '@/offline';

import { db } from '../db';
import { API_URL } from '../fixtures';
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

it('AC-05.1.2 opens a previously viewed task offline', async () => {
  const client = newClient();
  client.setQueryData(qk.tasks.detail('task-crash'), {
    data: db.tasks.find((task) => task.id === 'task-crash'),
  });
  await client.invalidateQueries({
    queryKey: qk.tasks.detail('task-crash'),
    refetchType: 'none',
  });
  goOffline();
  server.use(http.get(`${API_URL}/api/v1/*`, () => HttpResponse.error()));
  await renderWithProviders(
    <TaskDetailScreen
      taskId="task-crash"
      onBack={jest.fn()}
      onEdit={jest.fn()}
      onOpenTeam={jest.fn()}
      onDeleted={jest.fn()}
    />,
    { queryClient: client },
  );
  expect(
    await screen.findByRole('header', { name: 'Fix crash on Android' }),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Esta tarefa não existe mais.')).toBeNull();
});

it('AC-05.3.3 AC-05.4.1 changes status twice and deletes from the detail while offline', async () => {
  const client = newClient();
  client.setQueryData(qk.tasks.detail('task-crash'), {
    data: db.tasks.find((task) => task.id === 'task-crash'),
  });
  goOffline();
  const onDeleted = jest.fn();
  await renderWithProviders(
    <TaskDetailScreen
      taskId="task-crash"
      onBack={jest.fn()}
      onEdit={jest.fn()}
      onOpenTeam={jest.fn()}
      onDeleted={onDeleted}
    />,
    { queryClient: client },
  );
  const status = (name: string) =>
    within(screen.getByLabelText('Alterar status')).getByRole('radio', {
      name,
    });
  await fireEvent.press(status('Em andamento'));
  await act(() => settle());
  expect(status('Em andamento')).toBeSelected();
  expect(status('Concluída')).toBeEnabled();
  await fireEvent.press(status('Concluída'));
  await act(() => settle());
  expect(status('Concluída')).toBeSelected();

  await fireEvent.press(screen.getByRole('button', { name: 'Excluir tarefa' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
  expect(onDeleted).toHaveBeenCalledTimes(1);

  await act(() => goOnline(client));
  expect(db.tasks.some((task) => task.id === 'task-crash')).toBe(false);
});
