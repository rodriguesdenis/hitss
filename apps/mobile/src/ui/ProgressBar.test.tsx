import { AccessibilityInfo, Animated } from 'react-native';

import { renderUi, screen, styleOf, token } from '../../tests/renderUi';

import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['light', 'dark'] as const)(
    'shows a thin primary bar announced as busy (%s)',
    async (scheme) => {
      await renderUi(<ProgressBar visible label="Carregando tarefas" />, {
        scheme,
      });
      const bar = screen.getByLabelText('Carregando tarefas');
      expect(bar).toBeBusy();
      expect(styleOf(bar)).toMatchObject({
        height: 2,
        backgroundColor: token('primary', scheme),
      });
    },
  );

  it('keeps its space but renders nothing to announce when idle', async () => {
    await renderUi(<ProgressBar visible={false} label="Carregando tarefas" />);
    expect(screen.queryByLabelText('Carregando tarefas')).toBeNull();
  });

  it('AC-04.12.4 does not pulse with reduced motion', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    const stop = jest.fn();
    jest
      .spyOn(Animated, 'loop')
      .mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
    await renderUi(<ProgressBar visible label="Carregando tarefas" />);
    expect(stop).toHaveBeenCalled();
    expect(styleOf(screen.getByLabelText('Carregando tarefas')).opacity).toBe(
      1,
    );
  });
});
