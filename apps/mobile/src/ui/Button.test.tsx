import {
  expectTouchTarget,
  fireEvent,
  renderUi,
  screen,
  styleOf,
  token,
} from '../../tests/renderUi';

import { Button } from './Button';
import { Fab } from './Fab';
import { IconButton } from './IconButton';

describe('Button', () => {
  it.each(['light', 'dark'] as const)(
    'AC-04.12.1 is a named button with a 44 pt target in %s',
    async (scheme) => {
      await renderUi(<Button label="Criar tarefa" onPress={jest.fn()} />, {
        scheme,
      });
      const button = screen.getByRole('button', { name: 'Criar tarefa' });
      expectTouchTarget(button);
      expect(styleOf(button).backgroundColor).toBe(token('primary', scheme));
      expect(styleOf(screen.getByText('Criar tarefa')).color).toBe(
        token('on-primary', scheme),
      );
    },
  );

  it.each([
    ['secondary', 'fg'],
    ['danger', 'on-danger'],
    ['ghost', 'primary'],
    ['ghost-danger', 'danger'],
  ] as const)('AC-04.12.1 styles the %s variant', async (variant, role) => {
    await renderUi(
      <Button label="Excluir" variant={variant} onPress={jest.fn()} />,
    );
    expectTouchTarget(screen.getByRole('button', { name: 'Excluir' }));
    expect(styleOf(screen.getByText('Excluir')).color).toBe(token(role));
  });

  it('AC-04.9.6 ignores presses and reports busy while loading', async () => {
    const onPress = jest.fn();
    await renderUi(
      <Button
        label="Entrar"
        loadingLabel="Entrando…"
        loading
        onPress={onPress}
      />,
    );
    const button = screen.getByRole('button', { name: 'Entrando…' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });

  it('AC-04.12.1 announces the disabled state and dims', async () => {
    const onPress = jest.fn();
    await renderUi(<Button label="Entrar" disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Entrar' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(styleOf(button).opacity).toBe(0.5);
  });

  it('calls onPress', async () => {
    const onPress = jest.fn();
    await renderUi(<Button label="Entrar" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('IconButton', () => {
  it('AC-04.12.1 labels an icon-only button with a 44 pt target', async () => {
    const onPress = jest.fn();
    await renderUi(
      <IconButton
        icon="more"
        label="Opções do time Mobile"
        onPress={onPress}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Opções do time Mobile',
    });
    expectTouchTarget(button);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Fab', () => {
  it('AC-04.12.1 is a labelled 56 pt primary button', async () => {
    await renderUi(<Fab label="Nova tarefa" onPress={jest.fn()} />);
    const fab = screen.getByRole('button', { name: 'Nova tarefa' });
    expectTouchTarget(fab);
    expect(styleOf(fab)).toMatchObject({
      position: 'absolute',
      backgroundColor: token('primary'),
    });
  });
});
