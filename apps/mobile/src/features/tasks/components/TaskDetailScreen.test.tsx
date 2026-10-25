import { AccessibilityInfo } from 'react-native';
import {
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

import { qk } from '@/lib/query-keys';

import { db } from '../../../../tests/db';
import { API_URL } from '../../../../tests/fixtures';
import {
  createTestQueryClient,
  renderWithProviders,
} from '../../../../tests/renderWithProviders';
import { server } from '../../../../tests/server';
import { TaskDetailScreen } from './TaskDetailScreen';

const writes: string[] = [];

beforeEach(() => {
  writes.length = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET') {
      writes.push(`${request.method} ${new URL(request.url).pathname}`);
    }
  });
});

afterEach(() => server.events.removeAllListeners());

function renderDetail(taskId: string, queryClient = createTestQueryClient()) {
  const props = {
    onBack: jest.fn(),
    onEdit: jest.fn(),
    onOpenTeam: jest.fn(),
    onDeleted: jest.fn(),
  };
  return renderWithProviders(<TaskDetailScreen taskId={taskId} {...props} />, {
    queryClient,
  }).then((result) => ({ ...result, props }));
}

const statusBar = () => within(screen.getByLabelText('Alterar status'));

describe('TaskDetailScreen', () => {
  it('AC-04.6.1 shows the title, status, description, teams, due date and dates', async () => {
    db.tasks[0]!.description = 'E-mail e senha, estados de erro.';
    await renderDetail('task-login');
    expect(
      await screen.findByRole('header', { name: 'Implement login screen' }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('status-badge').props.accessibilityLabel).toBe(
      'Em andamento',
    );
    expect(
      screen.getByText('E-mail e senha, estados de erro.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Backend' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeOnTheScreen();
    expect(screen.getByText('sábado, 31 de outubro de 2026')).toBeOnTheScreen();
    expect(
      screen.getByText('Criada em 1 de out. · Atualizada em 1 de out.'),
    ).toBeOnTheScreen();
  });

  it('AC-04.8.4 says "Sem times", "Sem prazo" and "Sem descrição" when empty', async () => {
    await renderDetail('task-deps');
    expect(await screen.findByText('Sem times')).toBeOnTheScreen();
    expect(screen.getByText('Sem prazo')).toBeOnTheScreen();
    expect(screen.getByText('Sem descrição')).toBeOnTheScreen();
  });

  it('AC-04.4.5 marks an overdue due date with the word', async () => {
    await renderDetail('task-crash');
    expect(
      await screen.findByText(
        'Atrasada · segunda-feira, 12 de outubro de 2026',
      ),
    ).toBeOnTheScreen();
  });

  it('shows the completion date of a done task', async () => {
    await renderDetail('task-palette');
    expect(await screen.findByText('Concluída em 1 de out.')).toBeOnTheScreen();
  });

  it('AC-04.8.3 shows every team chip and opens a team', async () => {
    db.tasks[0]!.teams = db.teams.map(({ id, name, colorHex }) => ({
      id,
      name,
      colorHex,
    }));
    const { props } = await renderDetail('task-login');
    await screen.findByRole('button', { name: 'Design' });
    expect(
      ['Backend', 'Design', 'Mobile'].map(
        (name) => screen.getByRole('button', { name }).props.accessibilityHint,
      ),
    ).toEqual(Array(3).fill('Mostra as tarefas deste time'));
    await fireEvent.press(screen.getByRole('button', { name: 'Design' }));
    expect(props.onOpenTeam).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'team-design' }),
    );
  });

  it('renders at once from a cached list page', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(qk.tasks.list({ limit: 20 }), {
      pages: [
        {
          data: db.tasks,
          meta: { total: 4, limit: 20, offset: 0, hasNextPage: false },
        },
      ],
      pageParams: [0],
    });
    await renderDetail('task-crash', queryClient);
    expect(
      screen.getByRole('header', { name: 'Fix crash on Android' }),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Carregando tarefa')).toBeNull();
  });

  it('AC-04.6.2 saves a new status and refreshes the lists', async () => {
    const { queryClient } = await renderDetail('task-crash');
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    await screen.findByRole('header', { name: 'Fix crash on Android' });
    await fireEvent.press(
      statusBar().getByRole('radio', { name: 'Concluída' }),
    );
    expect(await screen.findByText('Marcada como Concluída')).toBeOnTheScreen();
    expect(writes).toEqual(['PATCH /api/v1/tasks/task-crash/status']);
    expect(
      statusBar().getByRole('radio', { name: 'Concluída' }),
    ).toBeSelected();
    expect(screen.getByTestId('status-badge').props.accessibilityLabel).toBe(
      'Concluída',
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.tasks.lists() });
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Status alterado para Concluída',
    );
  });

  it('undoes a status change from the toast', async () => {
    await renderDetail('task-crash');
    await screen.findByRole('header', { name: 'Fix crash on Android' });
    await fireEvent.press(
      statusBar().getByRole('radio', { name: 'Em andamento' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Desfazer' }),
    );
    await waitFor(() =>
      expect(db.tasks.find((t) => t.id === 'task-crash')?.status).toBe(
        'PENDING',
      ),
    );
    await waitFor(() =>
      expect(
        statusBar().getByRole('radio', { name: 'Pendente' }),
      ).toBeSelected(),
    );
  });

  it('AC-04.6.3 sends nothing for the current status', async () => {
    await renderDetail('task-crash');
    await screen.findByRole('header', { name: 'Fix crash on Android' });
    await fireEvent.press(statusBar().getByRole('radio', { name: 'Pendente' }));
    expect(writes).toEqual([]);
  });

  it('AC-04.6.5 keeps the previous status and explains a rejected change', async () => {
    server.use(
      http.patch(`${API_URL}/api/v1/tasks/:id/status`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'x', traceId: 't' } },
          { status: 500 },
        ),
      ),
    );
    await renderDetail('task-crash');
    await screen.findByRole('header', { name: 'Fix crash on Android' });
    await fireEvent.press(
      statusBar().getByRole('radio', { name: 'Concluída' }),
    );
    expect(
      await screen.findByText(
        'Não foi possível salvar “Fix crash on Android”: Algo deu errado do nosso lado. Tente novamente.',
      ),
    ).toBeOnTheScreen();
    await waitFor(() =>
      expect(
        statusBar().getByRole('radio', { name: 'Pendente' }),
      ).toBeSelected(),
    );
  });

  it('AC-04.6.4 deletes after confirmation and goes back', async () => {
    const { props } = await renderDetail('task-crash');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Excluir tarefa' }),
    );
    expect(screen.getByText('Excluir esta tarefa?')).toBeOnTheScreen();
    expect(
      screen.getByText(
        '“Fix crash on Android” será removida. Isso não pode ser desfeito.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Tarefa excluída')).toBeOnTheScreen();
    expect(db.tasks.map((task) => task.id)).not.toContain('task-crash');
  });

  it('AC-04.6.4 keeps the task when the deletion is cancelled', async () => {
    await renderDetail('task-crash');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Excluir tarefa' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(writes).toEqual([]);
    expect(screen.queryByText('Excluir esta tarefa?')).toBeNull();
  });

  it('AC-04.6.5 explains a rejected deletion and stays', async () => {
    server.use(
      http.delete(`${API_URL}/api/v1/tasks/:id`, () => HttpResponse.error()),
    );
    const { props } = await renderDetail('task-crash');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Excluir tarefa' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
    expect(
      await screen.findByText(
        'Não foi possível salvar “Fix crash on Android”: Não foi possível conectar ao servidor. Verifique sua conexão.',
      ),
    ).toBeOnTheScreen();
    expect(props.onDeleted).not.toHaveBeenCalled();
    expect(
      screen.getByRole('header', { name: 'Fix crash on Android' }),
    ).toBeOnTheScreen();
  });

  it('AC-04.6.7 explains a task deleted elsewhere with a way back', async () => {
    const { props } = await renderDetail('task-gone');
    expect(
      await screen.findByText('Esta tarefa não existe mais.'),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para tarefas' }),
    );
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('opens the edit form', async () => {
    const { props } = await renderDetail('task-crash');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Editar' }),
    );
    expect(props.onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-crash' }),
    );
  });
});
