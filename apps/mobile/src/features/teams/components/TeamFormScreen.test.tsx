import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';

import { qk } from '@/lib/query-keys';

import { db } from '../../../../tests/db';
import { API_URL } from '../../../../tests/fixtures';
import { renderWithProviders } from '../../../../tests/renderWithProviders';
import { server } from '../../../../tests/server';
import { TeamFormScreen } from './TeamFormScreen';

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

function renderForm(teamId?: string) {
  const props = {
    onClose: jest.fn(),
    onDeleted: jest.fn(),
    onCreated: jest.fn(),
  };
  return renderWithProviders(
    <TeamFormScreen teamId={teamId} {...props} />,
  ).then((result) => ({ ...result, props }));
}

const nameInput = () => screen.getByTestId('team-name');
const hexInput = () => screen.getByTestId('team-hex');

describe('TeamFormScreen — create', () => {
  it('AC-04.3.1 creates a team with a name and a preset color', async () => {
    const { props, queryClient } = await renderForm();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    expect(screen.getByRole('header', { name: 'Novo time' })).toBeOnTheScreen();
    await fireEvent.changeText(nameInput(), '  Plataforma ');
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Esmeralda, #10B981' }),
    );
    expect(
      screen.getByRole('radio', { name: 'Esmeralda, #10B981' }),
    ).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Criar time' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([
      { name: 'Plataforma', colorHex: '#10B981', description: null },
    ]);
    expect(db.teams.map((team) => team.name)).toContain('Plataforma');
    expect(await screen.findByText('Time criado')).toBeOnTheScreen();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.teams.lists() });
    expect(props.onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Plataforma', colorHex: '#10B981' }),
    );
  });

  it('starts with Indigo and the placeholder preview', async () => {
    await renderForm();
    expect(
      screen.getByRole('radio', { name: 'Índigo, #6366F1' }),
    ).toBeSelected();
    expect(hexInput().props.value).toBe('#6366F1');
    expect(screen.getByLabelText('Prévia, Nome do time')).toBeOnTheScreen();
  });

  it.each([
    ['a', true],
    ['ab', false],
    ['a'.repeat(50), false],
    ['a'.repeat(51), true],
  ])(
    'AC-04.3.1 name %j shows the length error on blur: %s',
    async (name, shown) => {
      await renderForm();
      await fireEvent.changeText(nameInput(), name);
      await fireEvent(nameInput(), 'blur');
      await waitFor(() =>
        expect(
          screen.queryByLabelText(
            'Nome, obrigatório, O nome deve ter de 2 a 50 caracteres',
          ) !== null,
        ).toBe(shown),
      );
    },
  );

  it('AC-04.7.2 announces the errors and saves nothing on an invalid submit', async () => {
    await renderForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Criar time' }));
    await waitFor(() =>
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        'Corrija 1 erro para continuar',
      ),
    );
    expect(bodies).toEqual([]);
  });

  it('AC-04.3.2 shows a duplicate name on the name field and saves nothing', async () => {
    const { props } = await renderForm();
    await fireEvent.changeText(nameInput(), 'mobile');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar time' }));
    expect(
      await screen.findByLabelText(
        'Nome, obrigatório, Você já tem um time com este nome.',
      ),
    ).toBeOnTheScreen();
    expect(db.teams).toHaveLength(3);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('AC-04.3.5 previews a typed hex and selects the matching swatch', async () => {
    await renderForm();
    await fireEvent.changeText(nameInput(), 'QA');
    await fireEvent.changeText(hexInput(), 'ec4899');
    expect(screen.getByRole('radio', { name: 'Rosa, #EC4899' })).toBeSelected();
    expect(screen.getByLabelText('Prévia, QA')).toBeOnTheScreen();
    expect(screen.getByTestId('chip-preview').props.style).toEqual(
      expect.objectContaining({
        backgroundColor: 'ec4899'.length && '#EC4899',
      }),
    );
    await fireEvent(hexInput(), 'blur');
    expect(hexInput().props.value).toBe('#EC4899');
  });

  it('AC-04.3.5 explains an invalid hex and keeps the last valid preview', async () => {
    await renderForm();
    await fireEvent.changeText(hexInput(), '#12');
    await fireEvent(hexInput(), 'blur');
    expect(
      await screen.findByLabelText(
        'Cor em hexadecimal, Use uma cor como #6366F1',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('chip-preview').props.style).toEqual(
      expect.objectContaining({ backgroundColor: '#6366F1' }),
    );
  });

  it('AC-04.9.6 saves once when the button is pressed twice', async () => {
    const { props } = await renderForm();
    await fireEvent.changeText(nameInput(), 'Infra');
    const create = screen.getByRole('button', { name: 'Criar time' });
    await act(async () => {
      create.props.onClick({ nativeEvent: {} });
      create.props.onClick({ nativeEvent: {} });
    });
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(bodies).toHaveLength(1);
  });

  it('AC-05.6.4 retries a network blip and saves', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/teams`, () => HttpResponse.error(), {
        once: true,
      }),
    );
    const { props } = await renderForm();
    await fireEvent.changeText(nameInput(), 'Infra');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar time' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it('shows a network failure above the footer and keeps the input', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/teams`, () => HttpResponse.error()),
    );
    await renderForm();
    await fireEvent.changeText(nameInput(), 'Infra');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar time' }));
    expect(
      await screen.findByText(
        'Não foi possível conectar ao servidor. Verifique sua conexão.',
      ),
    ).toBeOnTheScreen();
    expect(nameInput().props.value).toBe('Infra');
  });

  it('AC-04.7.7 asks before discarding changes', async () => {
    const { props } = await renderForm();
    await fireEvent.changeText(nameInput(), 'Infra');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Descartar alterações?')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Continuar editando' }),
    );
    expect(props.onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Descartar' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes without asking when nothing changed', async () => {
    const { props } = await renderForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('TeamFormScreen — edit', () => {
  it('AC-04.3.3 renames a team and refreshes lists and task chips', async () => {
    const { props, queryClient } = await renderForm('team-mobile');
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    expect(await screen.findByDisplayValue('Mobile')).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Editar time' }),
    ).toBeOnTheScreen();
    await fireEvent.changeText(nameInput(), 'Apps');
    await fireEvent.press(screen.getByRole('radio', { name: 'Céu, #0EA5E9' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Salvar alterações' }),
    );
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([
      { name: 'Apps', colorHex: '#0EA5E9', description: null },
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.teams.lists() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.tasks.all });
    expect(db.tasks.find((task) => task.id === 'task-crash')?.teams).toEqual([
      { id: 'team-mobile', name: 'Apps', colorHex: '#0EA5E9' },
    ]);
    expect(await screen.findByText('Time atualizado')).toBeOnTheScreen();
    expect(props.onCreated).not.toHaveBeenCalled();
  });

  it('AC-04.3.4 deletes from the form after confirmation and keeps the tasks', async () => {
    const { props } = await renderForm('team-design');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Excluir time' }),
    );
    expect(screen.getByText('Excluir “Design”?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledTimes(1));
    expect(db.teams.map((team) => team.id)).not.toContain('team-design');
    expect(db.tasks.find((task) => task.id === 'task-palette')?.teams).toEqual(
      [],
    );
  });

  it('shows "Não encontrado" for a team deleted elsewhere', async () => {
    const { props } = await renderForm('team-gone');
    expect(await screen.findByText('Não encontrado')).toBeOnTheScreen();
    expect(screen.getByText('Este time não existe mais.')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para times' }),
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('AC-04.9.1 shows a placeholder while the team loads', async () => {
    await renderForm('team-backend');
    expect(screen.getByLabelText('Carregando time')).toBeBusy();
    expect(await screen.findByDisplayValue('Backend')).toBeOnTheScreen();
  });
});
