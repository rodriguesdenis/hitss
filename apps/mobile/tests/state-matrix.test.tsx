import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';

import {
  TaskDetailScreen,
  TaskFormScreen,
  TasksListScreen,
} from '@/features/tasks';
import { TeamFormScreen, TeamsListScreen } from '@/features/teams';
import { useTaskFiltersStore } from '@/features/tasks/filters.store';
import { qk } from '@/lib/query-keys';

import { db } from './db';
import { API_URL } from './fixtures';
import { renderWithProviders } from './renderWithProviders';
import { server } from './server';

jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: (props: object) => createElement(View, props),
  };
});

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

function hold(method: Method, path: string) {
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http[method](`${API_URL}/api/v1${path}`, async () => {
      await pending;
    }),
  );
  return () => release();
}

function fail(
  method: Method,
  path: string,
  status: number,
  code: string,
  headers = {},
  once = true,
) {
  server.use(
    http[method](
      `${API_URL}/api/v1${path}`,
      () =>
        HttpResponse.json(
          { error: { code, message: 'server text', traceId: 't' } },
          { status, headers },
        ),
      { once },
    ),
  );
}

function offline(method: Method, path: string, once = true) {
  server.use(
    http[method](`${API_URL}/api/v1${path}`, () => HttpResponse.error(), {
      once,
    }),
  );
}

const noop = () => {};

beforeEach(() => useTaskFiltersStore.getState().reset());

async function pressWithoutWaiting(name: string) {
  const button = screen.getByRole('button', { name });
  await act(async () => {
    button.props.onClick({ nativeEvent: {} });
  });
}

const tasksList = (teamId?: string) => (
  <TasksListScreen
    teamId={teamId}
    onOpenTask={noop}
    onCreateTask={noop}
    onShowAll={noop}
    onBackToTeams={noop}
    onEditTeam={noop}
  />
);

const teamsList = () => (
  <TeamsListScreen onOpenTeam={noop} onCreateTeam={noop} onEditTeam={noop} />
);

const taskDetail = (taskId: string) => (
  <TaskDetailScreen
    taskId={taskId}
    onBack={noop}
    onEdit={noop}
    onOpenTeam={noop}
    onDeleted={noop}
  />
);

const NETWORK = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
const SERVER = 'Algo deu errado do nosso lado. Tente novamente.';

async function expectRetryRecovers(
  ui: ReactElement,
  path: string,
  ready: string,
) {
  offline('get', path);
  await renderWithProviders(ui);
  expect(await screen.findByText('Você está offline')).toBeOnTheScreen();
  expect(screen.getByText(NETWORK)).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tentar novamente' }),
  );
  expect(await screen.findByText(ready)).toBeOnTheScreen();
}

async function expectCachedErrorToast(
  ui: ReactElement,
  path: string,
  ready: string,
  key: readonly unknown[],
) {
  const { queryClient } = await renderWithProviders(ui);
  await screen.findByText(ready);
  offline('get', path, false);
  await act(async () => queryClient.invalidateQueries({ queryKey: key }));
  expect(await screen.findByText(NETWORK)).toBeOnTheScreen();
  expect(
    within(screen.getByTestId('toast')).getByRole('button', {
      name: 'Tentar novamente',
    }),
  ).toBeOnTheScreen();
  expect(screen.getByText(ready)).toBeOnTheScreen();
}

describe('S3 Tasks', () => {
  it('loading — AC-04.9.1 skeleton rows', async () => {
    const release = hold('get', '/tasks');
    await renderWithProviders(tasksList());
    expect(screen.getByLabelText('Carregando tarefas')).toBeBusy();
    release();
    expect(await screen.findByText('Implement login screen')).toBeOnTheScreen();
  });

  it('empty — AC-04.9.2 no tasks yet', async () => {
    db.tasks = [];
    await renderWithProviders(tasksList());
    expect(await screen.findByText('Nenhuma tarefa ainda')).toBeOnTheScreen();
  });

  it('empty — AC-04.5.4 filtered', async () => {
    await renderWithProviders(tasksList());
    await screen.findByText('Implement login screen');
    await fireEvent.changeText(screen.getByRole('search'), 'zzz');
    expect(
      await screen.findByText('Nenhuma tarefa corresponde aos filtros'),
    ).toBeOnTheScreen();
  });

  it('error — AC-04.9.3 error state with retry', async () => {
    await expectRetryRecovers(tasksList(), '/tasks', 'Implement login screen');
  });

  it('error — AC-04.9.3 cached data stays with a retry toast', async () => {
    await expectCachedErrorToast(
      tasksList(),
      '/tasks',
      'Implement login screen',
      qk.tasks.lists(),
    );
  });

  it('error — AC-04.9.5 rate limit shows the wait in seconds', async () => {
    fail('get', '/tasks', 429, 'RATE_LIMITED', { 'Retry-After': '7' });
    await renderWithProviders(tasksList());
    expect(
      await screen.findByText('Muitas requisições. Tente novamente em 7 s.'),
    ).toBeOnTheScreen();
  });

  it('error — AC-04.9.5 an outdated route asks to update the app', async () => {
    fail('get', '/tasks', 404, 'ROUTE_NOT_FOUND');
    await renderWithProviders(tasksList());
    expect(
      await screen.findByText(
        'Algo está desatualizado. Atualize o aplicativo.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Não foi possível carregar')).toBeOnTheScreen();
    expect(screen.queryByText('server text')).toBeNull();
  });

  it('success — AC-04.9.4 a status change is confirmed by a toast', async () => {
    await renderWithProviders(tasksList());
    await fireEvent(
      await screen.findByRole('button', { name: /^Fix crash/ }),
      'longPress',
    );
    await fireEvent.press(
      within(screen.getByTestId('status-sheet')).getByRole('radio', {
        name: 'Concluída',
      }),
    );
    expect(await screen.findByText('Marcada como Concluída')).toBeOnTheScreen();
  });
});

describe('S4 Teams', () => {
  it('loading — AC-04.9.1 skeleton rows', async () => {
    const release = hold('get', '/teams');
    await renderWithProviders(teamsList());
    expect(screen.getByLabelText('Carregando times')).toBeBusy();
    release();
    expect(await screen.findByText('Mobile')).toBeOnTheScreen();
  });

  it('empty — AC-04.9.2 no teams yet', async () => {
    db.teams = [];
    await renderWithProviders(teamsList());
    expect(await screen.findByText('Nenhum time ainda')).toBeOnTheScreen();
  });

  it('empty — filtered by search', async () => {
    await renderWithProviders(teamsList());
    await screen.findByText('Mobile');
    await fireEvent.changeText(screen.getByRole('search'), 'zzz');
    expect(
      await screen.findByText('Nenhum time corresponde a “zzz”'),
    ).toBeOnTheScreen();
  });

  it('error — AC-04.9.3 error state with retry', async () => {
    await expectRetryRecovers(teamsList(), '/teams', 'Mobile');
  });

  it('error — AC-04.9.3 cached data stays with a retry toast', async () => {
    await expectCachedErrorToast(
      teamsList(),
      '/teams',
      'Mobile',
      qk.teams.lists(),
    );
  });
});

describe('S6 Team tasks', () => {
  it('loading — AC-04.9.1 skeleton rows', async () => {
    const release = hold('get', '/tasks');
    await renderWithProviders(tasksList('team-mobile'));
    expect(screen.getByLabelText('Carregando tarefas')).toBeBusy();
    release();
    expect(await screen.findByText('Fix crash on Android')).toBeOnTheScreen();
  });

  it('empty — AC-04.9.2 no tasks in the team', async () => {
    db.tasks = [];
    await renderWithProviders(tasksList('team-backend'));
    expect(
      await screen.findByText('Nenhuma tarefa em Backend ainda'),
    ).toBeOnTheScreen();
  });

  it('error — not found for a deleted team', async () => {
    await renderWithProviders(tasksList('team-gone'));
    expect(
      await screen.findByText('Este time não existe mais.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Voltar para times' }),
    ).toBeOnTheScreen();
  });
});

describe('S7 Task detail', () => {
  it('loading — AC-04.9.1 skeleton for a deep link', async () => {
    const release = hold('get', '/tasks/:id');
    await renderWithProviders(taskDetail('task-login'));
    expect(screen.getByLabelText('Carregando tarefa')).toBeBusy();
    release();
    expect(await screen.findByText('Implement login screen')).toBeOnTheScreen();
  });

  it('error — AC-04.9.3 error state with retry', async () => {
    fail('get', '/tasks/:id', 500, 'INTERNAL_ERROR');
    await renderWithProviders(taskDetail('task-login'));
    expect(await screen.findByText(SERVER)).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(
      await screen.findByRole('header', { name: 'Implement login screen' }),
    ).toBeOnTheScreen();
  });

  it('error — AC-04.6.7 not found', async () => {
    await renderWithProviders(taskDetail('task-gone'));
    expect(
      await screen.findByText('Esta tarefa não existe mais.'),
    ).toBeOnTheScreen();
  });

  it('success — AC-04.9.4 toast with Desfazer', async () => {
    await renderWithProviders(taskDetail('task-crash'));
    await fireEvent.press(
      within(await screen.findByLabelText('Alterar status')).getByRole(
        'radio',
        {
          name: 'Concluída',
        },
      ),
    );
    expect(
      await screen.findByRole('button', { name: 'Desfazer' }),
    ).toBeOnTheScreen();
  });
});

describe('S8/S9 Task form', () => {
  it('loading — teams skeleton in the picker', async () => {
    const release = hold('get', '/teams');
    await renderWithProviders(<TaskFormScreen onClose={noop} />);
    expect(screen.getByLabelText('Carregando times')).toBeBusy();
    release();
    expect(
      await screen.findByRole('checkbox', { name: 'Mobile' }),
    ).toBeOnTheScreen();
  });

  it('loading — AC-04.9.6 footer spinner while saving', async () => {
    const release = hold('post', '/tasks');
    await renderWithProviders(<TaskFormScreen onClose={noop} />);
    await fireEvent.changeText(
      screen.getByTestId('task-title'),
      'Salvar devagar',
    );
    await pressWithoutWaiting('Criar tarefa');
    const saving = await screen.findByRole('button', { name: 'Salvando…' });
    expect(saving).toBeBusy();
    expect(saving).toBeDisabled();
    release();
    expect(await screen.findByText('Tarefa criada')).toBeOnTheScreen();
  });

  it('empty — no teams yet', async () => {
    db.teams = [];
    await renderWithProviders(<TaskFormScreen onClose={noop} />);
    expect(await screen.findByText('Nenhum time ainda')).toBeOnTheScreen();
  });

  it('error — the picker explains a failed load and retries', async () => {
    offline('get', '/teams');
    await renderWithProviders(<TaskFormScreen onClose={noop} />);
    expect(
      await screen.findByText('Não foi possível carregar os times.'),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(
      await screen.findByRole('checkbox', { name: 'Mobile' }),
    ).toBeOnTheScreen();
  });

  it('error — AC-04.7.8 banner for a failed save, input kept', async () => {
    offline('post', '/tasks', false);
    await renderWithProviders(<TaskFormScreen onClose={noop} />);
    await fireEvent.changeText(screen.getByTestId('task-title'), 'Sem rede');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(await screen.findByText(NETWORK)).toBeOnTheScreen();
    expect(screen.getByTestId('task-title').props.value).toBe('Sem rede');
  });

  it('error — not found when editing a deleted task', async () => {
    await renderWithProviders(
      <TaskFormScreen taskId="task-gone" onClose={noop} />,
    );
    expect(
      await screen.findByText('Esta tarefa não existe mais.'),
    ).toBeOnTheScreen();
  });

  it('loading — skeleton while the task loads', async () => {
    const release = hold('get', '/tasks/:id');
    await renderWithProviders(
      <TaskFormScreen taskId="task-login" onClose={noop} />,
    );
    expect(screen.getByLabelText('Carregando tarefa')).toBeBusy();
    release();
    expect(
      await screen.findByDisplayValue('Implement login screen'),
    ).toBeOnTheScreen();
  });

  it('success — AC-04.9.4 toast and close', async () => {
    const onClose = jest.fn();
    await renderWithProviders(<TaskFormScreen onClose={onClose} />);
    await fireEvent.changeText(
      screen.getByTestId('task-title'),
      'Nova tarefa ok',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(await screen.findByText('Tarefa criada')).toBeOnTheScreen();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('S10/S11 Team form', () => {
  it('loading — AC-04.9.6 footer spinner while saving', async () => {
    const release = hold('post', '/teams');
    await renderWithProviders(<TeamFormScreen onClose={noop} />);
    await fireEvent.changeText(screen.getByTestId('team-name'), 'Infra');
    await pressWithoutWaiting('Criar time');
    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeBusy();
    release();
    expect(await screen.findByText('Time criado')).toBeOnTheScreen();
  });

  it('loading — skeleton for a deep link', async () => {
    const release = hold('get', '/teams/:id');
    await renderWithProviders(
      <TeamFormScreen teamId="team-mobile" onClose={noop} />,
    );
    expect(screen.getByLabelText('Carregando time')).toBeBusy();
    release();
    expect(await screen.findByDisplayValue('Mobile')).toBeOnTheScreen();
  });

  it('error — AC-04.3.2 field error for a duplicate name', async () => {
    await renderWithProviders(<TeamFormScreen onClose={noop} />);
    await fireEvent.changeText(screen.getByTestId('team-name'), 'Design');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar time' }));
    expect(
      await screen.findByLabelText(
        'Nome, obrigatório, Você já tem um time com este nome.',
      ),
    ).toBeOnTheScreen();
  });

  it('error — banner for a failed save', async () => {
    fail('post', '/teams', 500, 'INTERNAL_ERROR', {}, false);
    await renderWithProviders(<TeamFormScreen onClose={noop} />);
    await fireEvent.changeText(screen.getByTestId('team-name'), 'Infra');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar time' }));
    expect(await screen.findByText(SERVER)).toBeOnTheScreen();
  });

  it('error — not found', async () => {
    await renderWithProviders(
      <TeamFormScreen teamId="team-gone" onClose={noop} />,
    );
    expect(
      await screen.findByText('Este time não existe mais.'),
    ).toBeOnTheScreen();
  });

  it('success — AC-04.9.4 toast and close', async () => {
    const onClose = jest.fn();
    await renderWithProviders(<TeamFormScreen onClose={onClose} />);
    await fireEvent.changeText(screen.getByTestId('team-name'), 'Infra');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar time' }));
    expect(await screen.findByText('Time criado')).toBeOnTheScreen();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Team delete', () => {
  async function deleteFromList(name: string) {
    await renderWithProviders(teamsList());
    await fireEvent.press(
      await screen.findByRole('button', { name: `Opções do time ${name}` }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir time' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
  }

  it('error — toast and the row stays', async () => {
    fail('delete', '/teams/:id', 500, 'INTERNAL_ERROR', {}, false);
    await deleteFromList('Design');
    expect(
      await screen.findByText(`Não foi possível salvar “Design”: ${SERVER}`),
    ).toBeOnTheScreen();
    expect(screen.getByText('Design')).toBeOnTheScreen();
  });

  it('success — AC-04.9.4 toast "Time excluído"', async () => {
    await deleteFromList('Design');
    expect(await screen.findByText('Time excluído')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Design')).toBeNull());
  });
});
