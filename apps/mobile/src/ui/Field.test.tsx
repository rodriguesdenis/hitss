import { act, useState } from 'react';
import { renderHook } from '@testing-library/react-native';

import {
  expectTouchTarget,
  fireEvent,
  renderUi,
  screen,
  styleOf,
  token,
} from '../../tests/renderUi';

import { Field } from './Field';
import { Input } from './Input';
import { SearchInput } from './SearchInput';
import { TextArea } from './TextArea';
import { useDebouncedValue } from './useDebouncedValue';

const hidden = { includeHiddenElements: true };

describe('Field + Input', () => {
  it('AC-04.12.1 names the input from its visible label and marks it required', async () => {
    await renderUi(
      <Field label="Título" required>
        <Input value="" onChangeText={jest.fn()} />
      </Field>,
    );
    expect(screen.getByText('Título *', hidden)).toBeTruthy();
    const input = screen.getByLabelText('Título, obrigatório');
    expectTouchTarget(input, { width: false });
    expect(styleOf(input)).toMatchObject({
      borderColor: token('border-strong'),
      backgroundColor: token('surface'),
      color: token('fg'),
    });
  });

  it.each(['light', 'dark'] as const)(
    'AC-04.7.2 links the error to the field and outlines it in danger (%s)',
    async (scheme) => {
      await renderUi(
        <Field
          label="Título"
          required
          error="O título deve ter pelo menos 3 caracteres"
        >
          <Input value="ab" onChangeText={jest.fn()} />
        </Field>,
        { scheme },
      );
      const input = screen.getByLabelText(
        'Título, obrigatório, O título deve ter pelo menos 3 caracteres',
      );
      expect(styleOf(input)).toMatchObject({
        borderColor: token('danger', scheme),
        borderWidth: 2,
      });
      expect(
        styleOf(
          screen.getByText('O título deve ter pelo menos 3 caracteres', hidden),
        ).color,
      ).toBe(token('danger', scheme));
    },
  );

  it('shows the focus outline while focused', async () => {
    await renderUi(
      <Field label="Nome">
        <Input value="" onChangeText={jest.fn()} />
      </Field>,
    );
    const input = screen.getByLabelText('Nome');
    await fireEvent(input, 'focus');
    expect(styleOf(screen.getByLabelText('Nome'))).toMatchObject({
      borderColor: token('focus'),
      borderWidth: 2,
    });
    await fireEvent(screen.getByLabelText('Nome'), 'blur');
    expect(styleOf(screen.getByLabelText('Nome')).borderWidth).toBe(1);
  });

  it('shows help text when there is no error', async () => {
    await renderUi(
      <Field label="Senha" help="Pelo menos 8 caracteres">
        <Input value="" onChangeText={jest.fn()} />
      </Field>,
    );
    expect(
      styleOf(screen.getByText('Pelo menos 8 caracteres', hidden)).color,
    ).toBe(token('fg-subtle'));
  });

  it('AC-04.7.3 counts characters and turns the counter danger at the limit', async () => {
    const { rerender } = await renderUi(
      <Field label="Descrição" count={2} max={10}>
        <TextArea value="ab" onChangeText={jest.fn()} />
      </Field>,
    );
    expect(styleOf(screen.getByText('2 / 10', hidden)).color).toBe(
      token('fg-subtle'),
    );
    expect(screen.getByLabelText('2 de 10 caracteres')).toBeTruthy();
    expect(styleOf(screen.getByLabelText('Descrição')).minHeight).toBe(112);
    await rerender(
      <Field label="Descrição" count={10} max={10}>
        <TextArea value="abcdefghij" onChangeText={jest.fn()} />
      </Field>,
    );
    expect(styleOf(screen.getByText('10 / 10', hidden)).color).toBe(
      token('danger'),
    );
  });

  it('reports a non-editable input as disabled', async () => {
    await renderUi(
      <Field label="E-mail">
        <Input value="" editable={false} onChangeText={jest.fn()} />
      </Field>,
    );
    expect(screen.getByLabelText('E-mail')).toBeDisabled();
  });
});

describe('SearchInput', () => {
  function Harness({ onChange }: { onChange?: (value: string) => void }) {
    const [value, setValue] = useState('');
    return (
      <SearchInput
        value={value}
        onChangeText={(next) => {
          setValue(next);
          onChange?.(next);
        }}
        placeholder="Buscar tarefas"
      />
    );
  }

  it('AC-04.12.1 is a labelled search field limited to 100 characters', async () => {
    await renderUi(<Harness />);
    const input = screen.getByRole('search', { name: 'Buscar tarefas' });
    expect(input.props.maxLength).toBe(100);
    expect(styleOf(input).borderRadius).toBe(9999);
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).toBeNull();
  });

  it('AC-04.5.2 offers a 44 pt clear button once there is text', async () => {
    const onChange = jest.fn();
    await renderUi(<Harness onChange={onChange} />);
    await fireEvent.changeText(screen.getByRole('search'), 'login');
    const clear = screen.getByRole('button', { name: 'Limpar busca' });
    expectTouchTarget(clear);
    await fireEvent.press(clear);
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('search').props.value).toBe('');
  });
});

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('AC-04.5.2 emits once 300 ms after the last change', async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value),
      { initialProps: { value: '' } },
    );
    await rerender({ value: 'l' });
    await act(async () => jest.advanceTimersByTime(200));
    await rerender({ value: 'lo' });
    await act(async () => jest.advanceTimersByTime(299));
    expect(result.current).toBe('');
    await act(async () => jest.advanceTimersByTime(1));
    expect(result.current).toBe('lo');
  });
});
