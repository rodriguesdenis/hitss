import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { TaskStatusVars } from '@/features/tasks';
import { mk } from '@/lib/query-keys';
import { PendingSyncBadge, pendingLabel, usePendingSync } from '@/offline';

import { db } from '../db';
import { renderWithProviders } from '../renderWithProviders';
import {
  goOffline,
  goOnline,
  mutate,
  newClient,
  seedTasks,
  settle,
  setupOffline,
} from './harness';
import { TaskRow } from '@/features/tasks/components/TaskRow';
import { SettingsScreen } from '@/features/auth';

setupOffline();

const crash = { id: 'task-crash', title: 'Fix crash on Android' };

function Count() {
  return <Text>{`count ${usePendingSync().count}`}</Text>;
}

describe('pending sync markers', () => {
  it.each([
    [0, 'Todas as alterações sincronizadas'],
    [1, '1 alteração aguardando sincronização'],
    [2, '2 alterações aguardando sincronização'],
  ])('labels %i pending changes as "%s"', (count, label) => {
    expect(pendingLabel(count)).toBe(label);
  });

  it('AC-05.2.2 marks a change pending until the server confirms it', async () => {
    const client = newClient();
    await seedTasks(client, { limit: 20 });
    await renderWithProviders(
      <>
        <PendingSyncBadge id={crash.id} />
        <PendingSyncBadge id="task-deps" />
        <Count />
      </>,
      { queryClient: client },
    );
    expect(screen.queryByText('Sincronização pendente')).toBeNull();
    goOffline();
    await act(async () => {
      void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
        ...crash,
        status: 'DONE',
      });
      await settle();
    });
    expect(screen.getByTestId(`pending-sync-${crash.id}`)).toBeOnTheScreen();
    expect(screen.queryByTestId('pending-sync-task-deps')).toBeNull();
    expect(screen.getByText('count 1')).toBeOnTheScreen();
    await act(() => goOnline(client));
    await waitFor(() =>
      expect(screen.queryByText('Sincronização pendente')).toBeNull(),
    );
    expect(screen.getByText('count 0')).toBeOnTheScreen();
  });

  it('AC-05.2.2 shows the badge on the row and in its spoken label', async () => {
    const client = newClient();
    goOffline();
    void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      ...crash,
      status: 'DONE',
    });
    await settle();
    const task = db.tasks.find((t) => t.id === crash.id)!;
    await renderWithProviders(
      <TaskRow task={task} onPress={jest.fn()} onLongPress={jest.fn()} />,
      {
        queryClient: client,
      },
    );
    expect(screen.getByText('Sincronização pendente')).toBeOnTheScreen();
    expect(
      screen.getByTestId(`task-${crash.id}`).props.accessibilityLabel,
    ).toMatch(/Sincronização pendente\.$/);
  });

  it('AC-05.2.4 shows the pending count in Settings', async () => {
    const client = newClient();
    goOffline();
    void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      ...crash,
      status: 'DONE',
    });
    await settle();
    await renderWithProviders(<SettingsScreen />, { queryClient: client });
    expect(
      await screen.findByText('1 alteração aguardando sincronização'),
    ).toBeOnTheScreen();
  });
});
