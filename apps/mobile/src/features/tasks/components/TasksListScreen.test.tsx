import type { TaskResponseDto } from '@hitss/api-client';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

import { db } from '../../../../tests/db';
import { API_URL } from '../../../../tests/fixtures';
import { renderWithProviders } from '../../../../tests/renderWithProviders';
import { server } from '../../../../tests/server';
import { useTaskFiltersStore } from '../filters.store';
import { TasksListScreen } from './TasksListScreen';

const requests: URL[] = [];

beforeEach(() => {
  useTaskFiltersStore.getState().reset();
  requests.length = 0;
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/tasks') {
      requests.push(url);
    }
  });
});

afterEach(() => server.events.removeAllListeners());

function renderList(teamId?: string) {
  const props = {
    teamId,
    onOpenTask: jest.fn(),
    onCreateTask: jest.fn(),
    onShowAll: jest.fn(),
    onBackToTeams: jest.fn(),
    onEditTeam: jest.fn(),
  };
  return renderWithProviders(<TasksListScreen {...props} />).then((result) => ({
    ...result,
    props,
  }));
}

const rows = () =>
  screen
    .queryAllByRole('button', { name: /\.$/ })
    .map((row) => row.props.accessibilityLabel as string);

const titles = () => rows().map((label) => label.split('.')[0]);

function makeTasks(count: number): TaskResponseDto[] {
  return Array.from({ length: count }, (_, index) => ({
    ...db.tasks[3]!,
    id: `task-${index + 1}`,
    title: `Tarefa ${String(index + 1).padStart(2, '0')}`,
  }));
}

describe('TasksListScreen — global', () => {
  it('AC-04.9.1 shows row-shaped placeholders while loading', async () => {
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API_URL}/api/v1/tasks`, async () => {
        await pending;
        return HttpResponse.json({
          data: [],
          meta: { total: 0, limit: 20, offset: 0, hasNextPage: false },
        });
      }),
    );
    await renderList();
    expect(screen.getByLabelText('Carregando tarefas')).toBeBusy();
    release();
    expect(await screen.findByText('Nenhuma tarefa ainda')).toBeOnTheScreen();
  });

  it('AC-04.4.1 lists every task, with or without teams, newest first', async () => {
    await renderList();
    await screen.findByText('Implement login screen');
    expect(titles()).toEqual([
      'Implement login screen',
      'Fix crash on Android',
      'Define color palette',
      'Update dependencies',
    ]);
    expect(requests[0]!.searchParams.get('sort')).toBe('-createdAt');
    expect(requests[0]!.searchParams.has('teamId')).toBe(false);
  });

  it('AC-04.8.1 announces each row with status, teams and due date', async () => {
    await renderList();
    await screen.findByText('Implement login screen');
    expect(rows()).toEqual([
      'Implement login screen. Em andamento. Times: Backend, Mobile. Prazo 31 de out..',
      'Fix crash on Android. Pendente. Times: Mobile. Prazo 12 de out., atrasada.',
      'Define color palette. Concluída. Times: Design.',
      'Update dependencies. Pendente.',
    ]);
    expect(
      screen.getByRole('button', { name: /^Implement login/ }).props
        .accessibilityHint,
    ).toBe('Abre os detalhes da tarefa');
  });

  it('AC-04.8.4 shows no chip row for a task without teams', async () => {
    await renderList();
    await screen.findByText('Update dependencies');
    expect(screen.queryAllByLabelText(/^Times:/)).toHaveLength(3);
  });

  it('AC-04.4.5 marks an overdue task with the word and an icon', async () => {
    await renderList();
    const label = await screen.findByText('Atrasada · 12 de out.');
    expect(label).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('task-task-crash')).getByTestId(
        'overdue-icon',
        { includeHiddenElements: true },
      ).props.iconName,
    ).toBe('alert-outline');
  });

  it('AC-04.4.6 opens the tapped task', async () => {
    const { props } = await renderList();
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Fix crash/ }),
    );
    expect(props.onOpenTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-crash' }),
    );
  });

  it('AC-04.4.3 loads pages of 20 until "Isso é tudo"', async () => {
    db.tasks = makeTasks(45);
    await renderList();
    await screen.findByText('Tarefa 01');
    for (const loaded of [40, 45]) {
      await act(async () =>
        screen.getByTestId('tasks-list').props.onEndReached(),
      );
      await waitFor(() =>
        expect(screen.getByTestId('tasks-list').props.data).toHaveLength(
          loaded,
        ),
      );
    }
    expect(
      requests.map((url) => url.searchParams.get('offset') ?? '0'),
    ).toEqual(['0', '20', '40']);
    expect(screen.getByText('Isso é tudo (45 tarefas)')).toBeOnTheScreen();
  });

  it('AC-04.4.4 refreshes from the first page keeping the filters', async () => {
    useTaskFiltersStore.getState().setStatus('all', 'PENDING');
    await renderList();
    await screen.findByText('Fix crash on Android');
    await act(async () =>
      screen.getByTestId('tasks-list').props.refreshControl.props.onRefresh(),
    );
    const last = requests.at(-1)!;
    expect(requests.length).toBeGreaterThan(1);
    expect(last.searchParams.getAll('status')).toEqual(['PENDING']);
    expect(last.searchParams.get('offset') ?? '0').toBe('0');
  });

  it('AC-04.9.3 keeps the list and explains when a refresh fails', async () => {
    await renderList();
    await screen.findByText('Implement login screen');
    server.use(http.get(`${API_URL}/api/v1/tasks`, () => HttpResponse.error()));
    await act(async () =>
      screen.getByTestId('tasks-list').props.refreshControl.props.onRefresh(),
    );
    expect(
      await screen.findByText(
        'Não foi possível atualizar. Exibindo dados salvos.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Implement login screen')).toBeOnTheScreen();
  });

  it('AC-04.9.3 explains a failed first load and retries', async () => {
    server.use(
      http.get(
        `${API_URL}/api/v1/tasks`,
        () =>
          HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'x', traceId: 't' } },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    await renderList();
    expect(
      await screen.findByText(
        'Algo deu errado do nosso lado. Tente novamente.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(await screen.findByText('Implement login screen')).toBeOnTheScreen();
  });

  it('AC-04.9.2 explains an empty list and offers a new task', async () => {
    db.tasks = [];
    const { props } = await renderList();
    expect(await screen.findByText('Nenhuma tarefa ainda')).toBeOnTheScreen();
    expect(
      screen.getByText('Registre sua primeira tarefa — leva segundos.'),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Nova tarefa' })[0]!,
    );
    expect(props.onCreateTask).toHaveBeenCalledWith(undefined);
  });
});

describe('TasksListScreen — filters', () => {
  it('AC-04.5.1 shows only the chosen status', async () => {
    await renderList();
    await screen.findByText('Implement login screen');
    await fireEvent.press(screen.getByRole('radio', { name: 'Concluída' }));
    await waitFor(() => expect(titles()).toEqual(['Define color palette']));
    expect(requests.at(-1)!.searchParams.getAll('status')).toEqual(['DONE']);
    expect(requests[0]!.searchParams.has('status')).toBe(false);
    await fireEvent.press(screen.getByRole('radio', { name: 'Todas' }));
    await waitFor(() => expect(titles()).toHaveLength(4));
  });

  it('AC-04.5.2 sends one search after fast typing', async () => {
    await renderList();
    await screen.findByText('Implement login screen');
    for (const text of ['l', 'lo', 'log', 'login']) {
      await fireEvent.changeText(screen.getByRole('search'), text);
    }
    await waitFor(() => expect(titles()).toEqual(['Implement login screen']));
    expect(
      requests
        .filter((url) => url.searchParams.has('search'))
        .map((url) => url.searchParams.get('search')),
    ).toEqual(['login']);
  });

  it('keeps the previous results under a progress bar while searching', async () => {
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API_URL}/api/v1/tasks`, async ({ request }) => {
        if (new URL(request.url).searchParams.has('search')) {
          await pending;
        }
      }),
    );
    await renderList();
    await screen.findByText('Implement login screen');
    expect(screen.queryByLabelText('Carregando tarefas')).toBeNull();
    await fireEvent.changeText(screen.getByRole('search'), 'login');
    expect(
      await screen.findByRole('progressbar', { name: 'Carregando tarefas' }),
    ).toBeBusy();
    expect(titles()).toHaveLength(4);
    release();
    await waitFor(() => expect(titles()).toEqual(['Implement login screen']));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('AC-04.5.4 explains filters that match nothing and clears them', async () => {
    await renderList();
    await screen.findByText('Implement login screen');
    await fireEvent.changeText(screen.getByRole('search'), 'zzz');
    expect(
      await screen.findByText('Nenhuma tarefa corresponde aos filtros'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Tente outro status ou termo de busca.'),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Limpar filtros' }),
    );
    await waitFor(() => expect(titles()).toHaveLength(4));
    expect(screen.getByRole('search').props.value).toBe('');
  });

  it('AC-04.5.5 keeps separate filters for the global and team lists', async () => {
    useTaskFiltersStore.getState().setStatus('all', 'DONE');
    await renderList('team-mobile');
    await screen.findByText('Fix crash on Android');
    expect(screen.getByRole('radio', { name: 'Todas' })).toBeSelected();
    expect(useTaskFiltersStore.getState().byScope.all?.status).toBe('DONE');
  });
});

describe('TasksListScreen — team', () => {
  it('AC-04.4.2 shows only the team tasks under the team name', async () => {
    await renderList('team-mobile');
    expect(
      await screen.findByRole('header', { name: 'Mobile' }),
    ).toBeOnTheScreen();
    await screen.findByText('Fix crash on Android');
    expect(titles()).toEqual([
      'Implement login screen',
      'Fix crash on Android',
    ]);
    expect(requests[0]!.searchParams.get('teamId')).toBe('team-mobile');
    expect(screen.getByText('2 tarefas')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Buscar em Mobile')).toBeOnTheScreen();
  });

  it('AC-04.5.1 combines the status with the team', async () => {
    await renderList('team-mobile');
    await screen.findByText('Fix crash on Android');
    await fireEvent.press(screen.getByRole('radio', { name: 'Pendente' }));
    await waitFor(() => expect(titles()).toEqual(['Fix crash on Android']));
    const last = requests.at(-1)!;
    expect(last.searchParams.get('teamId')).toBe('team-mobile');
    expect(last.searchParams.getAll('status')).toEqual(['PENDING']);
  });

  it('AC-04.9.2 offers a new task preselecting the team', async () => {
    db.tasks = [];
    const { props } = await renderList('team-design');
    expect(
      await screen.findByText('Nenhuma tarefa em Design ainda'),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Nova tarefa' })[0]!,
    );
    expect(props.onCreateTask).toHaveBeenCalledWith('team-design');
  });

  it('offers editing the team and showing all tasks', async () => {
    const { props } = await renderList('team-mobile');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Opções do time Mobile' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Editar time' }));
    expect(props.onEditTeam).toHaveBeenCalledWith('team-mobile');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Opções do time Mobile' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ver todas as tarefas' }),
    );
    expect(props.onShowAll).toHaveBeenCalledTimes(1);
  });

  it('shows a deleted team as not found with a way back', async () => {
    const { props } = await renderList('team-gone');
    expect(
      await screen.findByText('Este time não existe mais.'),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para times' }),
    );
    expect(props.onBackToTeams).toHaveBeenCalledTimes(1);
  });
});

describe('TasksListScreen — quick status', () => {
  it('AC-04.6.6 changes the status from a long press', async () => {
    await renderList();
    await fireEvent(
      await screen.findByRole('button', { name: /^Fix crash/ }),
      'longPress',
    );
    const sheet = within(screen.getByTestId('status-sheet'));
    expect(sheet.getByRole('radio', { name: 'Pendente' })).toBeSelected();
    await fireEvent.press(sheet.getByRole('radio', { name: 'Concluída' }));
    expect(await screen.findByText('Marcada como Concluída')).toBeOnTheScreen();
    expect(db.tasks.find((task) => task.id === 'task-crash')?.status).toBe(
      'DONE',
    );
    await waitFor(() =>
      expect(rows()).toContain(
        'Fix crash on Android. Concluída. Times: Mobile. Prazo 12 de out..',
      ),
    );
  });
});
