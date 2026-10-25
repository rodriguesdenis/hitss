import type { TeamResponseDto } from '@hitss/api-client';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { offerCreatedTeam, useCreatedTeamStore } from '@/features/teams';
import { toCalendarDate } from '@/lib/dates';

import { db } from '../../../../tests/db';
import { renderWithProviders } from '../../../../tests/renderWithProviders';
import { server } from '../../../../tests/server';
import { TaskFormScreen } from './TaskFormScreen';

jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: (props: object) => createElement(View, props),
  };
});

const bodies: unknown[] = [];

beforeEach(() => {
  bodies.length = 0;
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST' || request.method === 'PUT') {
      bodies.push(await request.clone().json());
    }
  });
});

afterEach(() => server.events.removeAllListeners());

function renderForm(props: { taskId?: string; teamId?: string } = {}) {
  const callbacks = { onClose: jest.fn(), onCreateTeam: jest.fn() };
  return renderWithProviders(<TaskFormScreen {...props} {...callbacks} />).then(
    (result) => ({ ...result, props: callbacks }),
  );
}

const title = () => screen.getByTestId('task-title');
const teamChip = (name: string) => screen.getByRole('checkbox', { name });

async function pickDate(date: Date) {
  await fireEvent.press(screen.getByTestId('task-due'));
  await fireEvent(
    screen.getByTestId('task-due-picker'),
    'change',
    { type: 'set' },
    date,
  );
}

function manyTeams(count: number): TeamResponseDto[] {
  return Array.from({ length: count }, (_, index) => ({
    ...db.teams[0]!,
    id: `team-x${index}`,
    name: `Time ${String(index).padStart(2, '0')}`,
  }));
}

describe('TaskFormScreen — create', () => {
  it('AC-04.7.1 creates a pending task with a trimmed title', async () => {
    const { props } = await renderForm();
    expect(
      screen.getByRole('header', { name: 'Nova tarefa' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Pendente' })).toBeSelected();
    await fireEvent.changeText(title(), '  Revisar contrato ');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([
      {
        title: 'Revisar contrato',
        description: null,
        status: 'PENDING',
        dueDate: null,
        teamIds: [],
      },
    ]);
    expect(db.tasks[0]?.title).toBe('Revisar contrato');
    expect(await screen.findByText('Tarefa criada')).toBeOnTheScreen();
  });

  it('AC-04.7.2 explains a short title on blur and clears it once valid', async () => {
    await renderForm();
    await fireEvent.changeText(title(), '  ab ');
    await fireEvent(title(), 'blur');
    expect(
      await screen.findByLabelText(
        'Título, obrigatório, O título deve ter pelo menos 3 caracteres',
      ),
    ).toBeOnTheScreen();
    await fireEvent.changeText(title(), 'abc');
    await waitFor(() =>
      expect(screen.getByLabelText('Título, obrigatório')).toBeOnTheScreen(),
    );
  });

  it('AC-04.7.2 saves nothing and announces the error count', async () => {
    const { AccessibilityInfo } =
      jest.requireActual<typeof import('react-native')>('react-native');
    await renderForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() =>
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        'Corrija 1 erro para continuar',
      ),
    );
    expect(bodies).toEqual([]);
  });

  it('AC-04.7.3 caps the description and counts it', async () => {
    await renderForm();
    expect(screen.getByTestId('task-description').props.maxLength).toBe(2000);
    await fireEvent.changeText(screen.getByTestId('task-description'), 'abc');
    expect(screen.getByText('3 / 2000')).toBeOnTheScreen();
  });

  it('AC-04.7.4 saves status, a past due date with a hint and teams', async () => {
    const { props } = await renderForm();
    await fireEvent.changeText(title(), 'Planejar sprint');
    await fireEvent.press(screen.getByRole('radio', { name: 'Em andamento' }));
    const past = new Date();
    past.setDate(past.getDate() - 3);
    await pickDate(past);
    expect(
      screen.getByText('Esta data já passou', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    await fireEvent.press(
      await screen.findByRole('checkbox', { name: 'Mobile' }),
    );
    await fireEvent.press(teamChip('Design'));
    expect(teamChip('Mobile')).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(bodies[0]).toEqual({
      title: 'Planejar sprint',
      description: null,
      status: 'IN_PROGRESS',
      dueDate: toCalendarDate(past),
      teamIds: ['team-mobile', 'team-design'],
    });
  });

  it('AC-04.7.4 stops at 10 teams', async () => {
    db.teams = manyTeams(11);
    await renderForm();
    await screen.findByRole('checkbox', { name: 'Time 00' });
    for (let index = 0; index < 10; index++) {
      await fireEvent.press(teamChip(`Time ${String(index).padStart(2, '0')}`));
    }
    expect(teamChip('Time 10')).toBeDisabled();
    expect(
      screen.getByText('Você pode escolher até 10 times', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    await fireEvent.press(teamChip('Time 10'));
    expect(teamChip('Time 10')).not.toBeChecked();
  });

  it('AC-04.7.5 preselects the team of the list it was opened from', async () => {
    await renderForm({ teamId: 'team-design' });
    expect(
      await screen.findByRole('checkbox', { name: 'Design' }),
    ).toBeChecked();
    expect(teamChip('Mobile')).not.toBeChecked();
  });

  it('AC-04.7.8 removes teams deleted elsewhere and keeps the input', async () => {
    await renderForm();
    await fireEvent.changeText(title(), 'Tarefa com times');
    await fireEvent.press(
      await screen.findByRole('checkbox', { name: 'Mobile' }),
    );
    await fireEvent.press(teamChip('Design'));
    db.teams = db.teams.filter((team) => team.id !== 'team-design');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(
      await screen.findByText(
        'Alguns times não existem mais e foram removidos',
        {
          includeHiddenElements: true,
        },
      ),
    ).toBeOnTheScreen();
    expect(teamChip('Mobile')).toBeChecked();
    expect(teamChip('Design')).not.toBeChecked();
    expect(title().props.value).toBe('Tarefa com times');
  });

  it('AC-04.9.6 creates once when the button is pressed twice', async () => {
    const { props } = await renderForm();
    await fireEvent.changeText(title(), 'Uma vez só');
    const create = screen.getByRole('button', { name: 'Criar tarefa' });
    await act(async () => {
      create.props.onClick({ nativeEvent: {} });
      create.props.onClick({ nativeEvent: {} });
    });
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(bodies).toHaveLength(1);
  });

  it('AC-04.7.7 asks before discarding changes', async () => {
    const { props } = await renderForm();
    await fireEvent.changeText(title(), 'Rascunho');
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Cancelar' })[0]!,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Continuar editando' }),
    );
    expect(props.onClose).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Cancelar' })[0]!,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Descartar' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('AC-04.7.4 comes back from "Novo time" with the new team selected', async () => {
    await renderForm();
    await fireEvent.press(
      await screen.findByRole('checkbox', { name: 'Mobile' }),
    );
    await act(async () => offerCreatedTeam('team-design'));
    expect(teamChip('Design')).toBeChecked();
    expect(teamChip('Mobile')).toBeChecked();
    expect(useCreatedTeamStore.getState().teamId).toBeUndefined();
  });

  it('opens the new-team form', async () => {
    const { props } = await renderForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Novo time' }));
    expect(props.onCreateTeam).toHaveBeenCalledTimes(1);
  });
});

describe('TaskFormScreen — edit', () => {
  it('AC-04.7.6 preloads the task and saves the new values', async () => {
    const { props } = await renderForm({ taskId: 'task-login' });
    expect(
      await screen.findByDisplayValue('Implement login screen'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Editar tarefa' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Em andamento' })).toBeSelected();
    expect(
      await screen.findByRole('checkbox', { name: 'Backend' }),
    ).toBeChecked();
    db.tasks[0]!.title = 'Changed elsewhere';
    await fireEvent.changeText(title(), 'Login com biometria');
    await fireEvent.press(teamChip('Backend'));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Salvar alterações' }),
    );
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([
      {
        title: 'Login com biometria',
        description: null,
        status: 'IN_PROGRESS',
        dueDate: '2026-10-31',
        teamIds: ['team-mobile'],
      },
    ]);
    expect(db.tasks.find((task) => task.id === 'task-login')?.title).toBe(
      'Login com biometria',
    );
    expect(await screen.findByText('Alterações salvas')).toBeOnTheScreen();
  });

  it('explains a task deleted elsewhere', async () => {
    const { props } = await renderForm({ taskId: 'task-gone' });
    expect(
      await screen.findByText('Esta tarefa não existe mais.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
