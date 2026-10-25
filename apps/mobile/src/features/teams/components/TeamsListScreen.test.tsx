import type { TeamResponseDto } from '@hitss/api-client';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

import { db } from '../../../../tests/db';
import { API_URL } from '../../../../tests/fixtures';
import { renderWithProviders } from '../../../../tests/renderWithProviders';
import { server } from '../../../../tests/server';
import { TeamsListScreen } from './TeamsListScreen';

const requests: URL[] = [];

beforeEach(() => {
  requests.length = 0;
  server.events.on('request:start', ({ request }) => {
    requests.push(new URL(request.url));
  });
});

afterEach(() => server.events.removeAllListeners());

function renderList() {
  const props = {
    onOpenTeam: jest.fn(),
    onCreateTeam: jest.fn(),
    onEditTeam: jest.fn(),
  };
  return renderWithProviders(<TeamsListScreen {...props} />).then((result) => ({
    ...result,
    props,
  }));
}

function makeTeams(count: number): TeamResponseDto[] {
  return Array.from({ length: count }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    return {
      ...db.teams[0]!,
      id: `team-${n}`,
      name: `Time ${n}`,
      taskCount: index,
    };
  });
}

const teamRows = () =>
  screen
    .getAllByRole('button', { name: /tarefa/ })
    .map((row) => row.props.accessibilityLabel as string);

describe('TeamsListScreen', () => {
  it('AC-04.9.1 shows team-shaped placeholders while loading', async () => {
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API_URL}/api/v1/teams`, async () => {
        await pending;
        return HttpResponse.json({
          data: [],
          meta: { total: 0, limit: 20, offset: 0, hasNextPage: false },
        });
      }),
    );
    await renderList();
    expect(screen.getByLabelText('Carregando times')).toBeBusy();
    release();
    expect(await screen.findByText('Nenhum time ainda')).toBeOnTheScreen();
  });

  it('AC-04.2.1 lists teams by name with description and task count', async () => {
    db.teams[2]!.description = 'Squad de iOS e Android';
    await renderList();
    await screen.findByText('Mobile');
    expect(teamRows()).toEqual([
      'Backend. 1 tarefa',
      'Design. 1 tarefa',
      'Mobile. Squad de iOS e Android. 2 tarefas',
    ]);
    expect(requests[0]!.searchParams.get('sort')).toBe('name');
    expect(requests[0]!.searchParams.get('limit')).toBe('20');
  });

  it('AC-04.2.2 opens the tasks of the tapped team', async () => {
    const { props } = await renderList();
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Mobile\./ }),
    );
    expect(props.onOpenTeam).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'team-mobile' }),
    );
    expect(
      screen.getByRole('button', { name: /^Mobile\./ }).props.accessibilityHint,
    ).toBe('Mostra as tarefas deste time');
  });

  it('AC-04.2.4 searches by name after the user stops typing', async () => {
    await renderList();
    await screen.findByText('Mobile');
    await fireEvent.changeText(screen.getByRole('search'), 'mob');
    await waitFor(() => expect(teamRows()).toEqual(['Mobile. 2 tarefas']));
    expect(
      requests
        .filter((url) => url.searchParams.has('search'))
        .map((url) => url.searchParams.get('search')),
    ).toEqual(['mob']);
  });

  it('AC-04.9.2 explains an empty list and offers to create a team', async () => {
    db.teams = [];
    const { props } = await renderList();
    expect(await screen.findByText('Nenhum time ainda')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Times agrupam tarefas relacionadas e dão uma cor a elas.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Criar time' }));
    expect(props.onCreateTeam).toHaveBeenCalledTimes(1);
  });

  it('AC-04.2.4 explains a search without results and clears it', async () => {
    await renderList();
    await screen.findByText('Mobile');
    await fireEvent.changeText(screen.getByRole('search'), 'zzz');
    expect(
      await screen.findByText('Nenhum time corresponde a “zzz”'),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Limpar busca' }).at(-1)!,
    );
    expect(await screen.findByText('Backend')).toBeOnTheScreen();
  });

  it('AC-04.9.3 explains a connection failure and retries', async () => {
    server.use(
      http.get(`${API_URL}/api/v1/teams`, () => HttpResponse.error(), {
        once: true,
      }),
    );
    await renderList();
    expect(
      await screen.findByText(
        'Não foi possível conectar ao servidor. Verifique sua conexão.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(await screen.findByText('Mobile')).toBeOnTheScreen();
  });

  it('AC-04.2.3 loads the next page with offset=20 at the end of the list', async () => {
    db.teams = makeTeams(25);
    await renderList();
    await screen.findByText('Time 01');
    const list = screen.getByTestId('teams-list');
    expect(list.props.data).toHaveLength(20);
    await act(async () => list.props.onEndReached());
    await waitFor(() =>
      expect(screen.getByTestId('teams-list').props.data).toHaveLength(25),
    );
    expect(
      requests.map((url) => url.searchParams.get('offset') ?? '0'),
    ).toEqual(['0', '20']);
    expect(screen.getByTestId('teams-list').props.data).toHaveLength(25);
  });

  it('AC-04.9.3 keeps the list and explains when a refresh fails', async () => {
    await renderList();
    await screen.findByText('Mobile');
    server.use(http.get(`${API_URL}/api/v1/teams`, () => HttpResponse.error()));
    await act(async () =>
      screen.getByTestId('teams-list').props.refreshControl.props.onRefresh(),
    );
    expect(
      await screen.findByText(
        'Não foi possível atualizar. Exibindo dados salvos.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Mobile')).toBeOnTheScreen();
  });

  it('opens the team options to edit', async () => {
    const { props } = await renderList();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Opções do time Mobile' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Editar time' }));
    expect(props.onEditTeam).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'team-mobile' }),
    );
  });

  it('AC-04.3.4 deletes a team after confirmation and keeps its tasks', async () => {
    await renderList();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Opções do time Mobile' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir time' }));
    expect(screen.getByText('Excluir “Mobile”?')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'As tarefas serão mantidas e deixarão de estar atribuídas a este time.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('Time excluído')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Mobile')).toBeNull());
    expect(db.tasks).toHaveLength(4);
    expect(
      db.tasks.flatMap((task) => task.teams).map((chip) => chip.name),
    ).not.toContain('Mobile');
  });

  it('cancelling the delete keeps the team', async () => {
    await renderList();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Opções do time Design' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir time' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(requests.some((url) => url.pathname.endsWith('team-design'))).toBe(
      false,
    );
    expect(db.teams.map((team) => team.name)).toContain('Design');
  });

  it('AC-04.12.1 names the new-team button', async () => {
    const { props } = await renderList();
    await fireEvent.press(screen.getByRole('button', { name: 'Novo time' }));
    expect(props.onCreateTeam).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: 'Times' })).toBeOnTheScreen();
  });
});
