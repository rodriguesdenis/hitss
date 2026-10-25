import { ApiError } from '@hitss/api-client';
import { AccessibilityInfo, Animated, Text } from 'react-native';

import {
  expectTouchTarget,
  fireEvent,
  renderUi,
  screen,
  styleOf,
  token,
} from '../../tests/renderUi';

import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Screen } from './Screen';
import { SkeletonList } from './Skeleton';

const apiError = (status: number, code: string) =>
  new ApiError(status, {
    error: { code, message: 'server text', traceId: 't' },
  });

describe('SkeletonList', () => {
  afterEach(() => jest.restoreAllMocks());

  it('AC-04.9.1 shows row-shaped placeholders announced as loading', async () => {
    await renderUi(<SkeletonList label="Carregando tarefas" />);
    const list = screen.getByLabelText('Carregando tarefas');
    expect(list).toBeBusy();
    expect(list.children).toHaveLength(6);
  });

  it('AC-04.9.1 renders five team rows', async () => {
    await renderUi(<SkeletonList label="Carregando times" variant="team" />);
    expect(screen.getByLabelText('Carregando times').children).toHaveLength(5);
  });

  it('AC-04.12.4 shimmers by default', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    await renderUi(<SkeletonList label="Carregando tarefas" />);
    expect(loop).toHaveBeenCalled();
  });

  it('AC-04.12.4 does not shimmer with reduced motion', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    const start = jest.fn();
    const stop = jest.fn();
    jest
      .spyOn(Animated, 'loop')
      .mockReturnValue({ start, stop, reset: jest.fn() });
    await renderUi(<SkeletonList label="Carregando tarefas" />);
    expect(stop).toHaveBeenCalled();
    expect(styleOf(screen.getByLabelText('Carregando tarefas')).opacity).toBe(
      1,
    );
  });
});

describe('EmptyState', () => {
  it('AC-04.9.2 explains and offers the next action', async () => {
    const onPress = jest.fn();
    await renderUi(
      <EmptyState
        icon="users"
        title="Nenhum time ainda"
        message="Times agrupam tarefas relacionadas e dão uma cor a elas."
        action={{ label: 'Criar time', onPress }}
      />,
    );
    expect(
      screen.getByRole('header', { name: 'Nenhum time ainda' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Times agrupam tarefas relacionadas e dão uma cor a elas.',
      ),
    ).toBeTruthy();
    const action = screen.getByRole('button', { name: 'Criar time' });
    expectTouchTarget(action);
    await fireEvent.press(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('AC-04.5.4 supports a secondary action', async () => {
    await renderUi(
      <EmptyState
        icon="search"
        title="Nenhuma tarefa corresponde aos filtros"
        action={{
          label: 'Limpar filtros',
          onPress: jest.fn(),
          variant: 'secondary',
        }}
      />,
    );
    expect(
      styleOf(screen.getByRole('button', { name: 'Limpar filtros' }))
        .borderColor,
    ).toBe(token('border-strong'));
  });
});

describe('ErrorState', () => {
  it('AC-04.9.3 tells a connection failure apart and retries', async () => {
    const onRetry = jest.fn();
    await renderUi(
      <ErrorState
        error={new TypeError('Network request failed')}
        onRetry={onRetry}
      />,
    );
    expect(
      screen.getByRole('alert', { name: 'Você está offline' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Não foi possível conectar ao servidor. Verifique sua conexão.',
      ),
    ).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Tentar novamente' });
    expectTouchTarget(retry);
    await fireEvent.press(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('AC-04.9.5 shows the pt-BR text for a server error, never the server message', async () => {
    await renderUi(
      <ErrorState
        error={apiError(500, 'INTERNAL_ERROR')}
        onRetry={jest.fn()}
      />,
    );
    expect(screen.getByText('Não foi possível carregar')).toBeTruthy();
    expect(
      screen.getByText('Algo deu errado do nosso lado. Tente novamente.'),
    ).toBeTruthy();
    expect(screen.queryByText('server text')).toBeNull();
  });

  it('AC-04.9.3 replaces retry with a custom action when not found', async () => {
    const back = jest.fn();
    await renderUi(
      <ErrorState
        error={apiError(404, 'TEAM_NOT_FOUND')}
        onRetry={jest.fn()}
        action={{ label: 'Voltar para times', onPress: back }}
      />,
    );
    expect(screen.getByText('Não encontrado')).toBeTruthy();
    expect(screen.getByText('Este time não existe mais.')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para times' }),
    );
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('Screen', () => {
  it.each(['light', 'dark'] as const)(
    'paints the canvas and respects the top safe area (%s)',
    async (scheme) => {
      await renderUi(
        <Screen testID="screen">
          <Text>Tarefas</Text>
        </Screen>,
        { scheme },
      );
      expect(styleOf(screen.getByTestId('screen'))).toMatchObject({
        backgroundColor: token('canvas', scheme),
        paddingTop: 47,
        paddingBottom: 0,
      });
    },
  );

  it('adds the gutter when padded', async () => {
    await renderUi(
      <Screen testID="screen" padded edges={['top', 'bottom']}>
        <Text>Ajustes</Text>
      </Screen>,
    );
    expect(styleOf(screen.getByTestId('screen')).paddingBottom).toBe(34);
    const gutter = screen.getByTestId('screen').children[0];
    expect(styleOf(gutter as never).paddingLeft).toBeGreaterThan(0);
  });
});
