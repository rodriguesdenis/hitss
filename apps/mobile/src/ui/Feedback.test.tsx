import { AccessibilityInfo } from 'react-native';

import {
  act,
  expectTouchTarget,
  fireEvent,
  renderUi,
  screen,
  styleOf,
  token,
} from '../../tests/renderUi';

import { ConfirmDialog } from './ConfirmDialog';
import { OfflineBanner } from './OfflineBanner';
import { Sheet, SheetOption } from './Sheet';
import { hideToast, showToast, useToastStore } from './toast.store';
import { Toaster } from './Toaster';

describe('toast store', () => {
  beforeEach(() => hideToast());

  it('keeps one toast at a time, newest replaces older', () => {
    showToast({ message: 'Time criado' });
    const id = showToast({ message: 'Time atualizado' });
    expect(useToastStore.getState().current).toMatchObject({
      id,
      message: 'Time atualizado',
    });
  });

  it('ignores hiding a toast that was already replaced', () => {
    const first = showToast({ message: 'Time criado' });
    showToast({ message: 'Time excluído' });
    hideToast(first);
    expect(useToastStore.getState().current?.message).toBe('Time excluído');
  });
});

describe('Toaster', () => {
  beforeEach(() => {
    hideToast();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each(['light', 'dark'] as const)(
    'AC-04.9.4 shows a short message that is announced and hides itself (%s)',
    async (scheme) => {
      await renderUi(<Toaster />, { scheme });
      await act(async () => {
        showToast({ message: 'Tarefa criada' });
      });
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        'Tarefa criada',
      );
      const toast = screen.getByTestId('toast');
      expect(toast.props.accessibilityLiveRegion).toBe('polite');
      expect(styleOf(toast).backgroundColor).toBe(token('inverse', scheme));
      expect(styleOf(screen.getByText('Tarefa criada')).color).toBe(
        token('on-inverse', scheme),
      );
      await act(async () => jest.advanceTimersByTime(3999));
      expect(screen.getByText('Tarefa criada')).toBeTruthy();
      await act(async () => jest.advanceTimersByTime(1));
      expect(screen.queryByText('Tarefa criada')).toBeNull();
    },
  );

  it('keeps error toasts for 6 s', async () => {
    await renderUi(<Toaster />);
    await act(async () => {
      showToast({
        message: 'Algo deu errado do nosso lado. Tente novamente.',
        tone: 'error',
      });
    });
    await act(async () => jest.advanceTimersByTime(5999));
    expect(screen.getByTestId('toast')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(1));
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('runs the action and closes', async () => {
    const undo = jest.fn();
    await renderUi(<Toaster />);
    await act(async () => {
      showToast({
        message: 'Marcada como Concluída',
        action: { label: 'Desfazer', onPress: undo },
      });
    });
    const action = screen.getByRole('button', { name: 'Desfazer' });
    expectTouchTarget(action);
    expect(styleOf(screen.getByText('Desfazer')).color).toBe(
      token('inverse-action'),
    );
    await fireEvent.press(action);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('gives an action toast 8 s when a screen reader is on', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
      .mockResolvedValue(true);
    await renderUi(<Toaster />);
    await act(async () => {
      showToast({
        message: 'Marcada como Concluída',
        action: { label: 'Desfazer', onPress: jest.fn() },
      });
    });
    await act(async () => jest.advanceTimersByTime(7999));
    expect(screen.getByTestId('toast')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(1));
    expect(screen.queryByTestId('toast')).toBeNull();
  });
});

describe('ConfirmDialog', () => {
  afterEach(() => jest.restoreAllMocks());

  function renderDialog(
    overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {},
  ) {
    const props = {
      visible: true,
      title: 'Excluir esta tarefa?',
      message: '“Implementar login” será removida. Isso não pode ser desfeito.',
      confirmLabel: 'Excluir',
      onConfirm: jest.fn(),
      onCancel: jest.fn(),
      ...overrides,
    };
    return renderUi(<ConfirmDialog {...props} />).then(() => props);
  }

  it('AC-04.12.1 focuses Cancelar first and lists it before the destructive action', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await renderDialog();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual([
      'Cancelar',
      'Excluir',
    ]);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    buttons.forEach((button) => expectTouchTarget(button));
    expect(
      screen.getByRole('header', { name: 'Excluir esta tarefa?' }),
    ).toBeTruthy();
  });

  it('styles the confirmation as danger and calls back', async () => {
    const props = await renderDialog();
    const confirm = screen.getByRole('button', { name: 'Excluir' });
    expect(styleOf(confirm).backgroundColor).toBe(token('danger'));
    await fireEvent.press(confirm);
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while hidden', async () => {
    await renderDialog({ visible: false });
    expect(screen.queryByText('Excluir esta tarefa?')).toBeNull();
  });
});

describe('Sheet', () => {
  it('AC-04.12.1 shows titled options and closes from the scrim', async () => {
    const onClose = jest.fn();
    const onEdit = jest.fn();
    await renderUi(
      <Sheet visible title="Opções do time Mobile" onClose={onClose}>
        <SheetOption label="Editar time" icon="edit" onPress={onEdit} />
        <SheetOption
          label="Excluir time"
          icon="trash"
          destructive
          onPress={jest.fn()}
        />
      </Sheet>,
    );
    expect(
      screen.getByRole('header', { name: 'Opções do time Mobile' }),
    ).toBeTruthy();
    const edit = screen.getByRole('button', { name: 'Editar time' });
    expectTouchTarget(edit, { width: false });
    await fireEvent.press(edit);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(styleOf(screen.getByText('Excluir time')).color).toBe(
      token('danger'),
    );
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Fechar',
        includeHiddenElements: true,
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    await fireEvent(
      screen.getByRole('header', { name: 'Opções do time Mobile' }).parent!,
      'accessibilityEscape',
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('AC-04.12.5 marks the selected option with state and a check', async () => {
    await renderUi(
      <Sheet visible title="Ordenar por" onClose={jest.fn()}>
        <SheetOption label="Mais recentes" selected onPress={jest.fn()} />
        <SheetOption
          label="Mais antigas"
          selected={false}
          onPress={jest.fn()}
        />
      </Sheet>,
    );
    expect(screen.getByRole('radio', { name: 'Mais recentes' })).toBeSelected();
    expect(
      screen.getByRole('radio', { name: 'Mais antigas' }),
    ).not.toBeSelected();
  });
});

describe('OfflineBanner', () => {
  it('renders nothing while online', async () => {
    await renderUi(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it.each(['light', 'dark'] as const)(
    'explains the offline state politely (%s)',
    async (scheme) => {
      await renderUi(<OfflineBanner status="offline" />, { scheme });
      const banner = screen.getByTestId('offline-banner');
      expect(banner.props.accessibilityLiveRegion).toBe('polite');
      expect(styleOf(banner).backgroundColor).toBe(
        token('warning-soft', scheme),
      );
      expect(
        screen.getByText(
          'Você está offline. As alterações serão sincronizadas ao reconectar.',
        ),
      ).toBeTruthy();
    },
  );

  it('reports syncing and synced', async () => {
    const { rerender } = await renderUi(
      <OfflineBanner status="syncing" pendingCount={2} />,
    );
    expect(
      screen.getByText('De volta online — sincronizando 2 alterações…'),
    ).toBeTruthy();
    await rerender(<OfflineBanner status="synced" />);
    expect(screen.getByText('Todas as alterações sincronizadas')).toBeTruthy();
  });
});
