import {
  expectTouchTarget,
  fireEvent,
  renderUi,
  screen,
  styleOf,
  token,
} from '../../tests/renderUi';

import { DatePickerField } from './DatePickerField';
import { Field } from './Field';

jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: (props: object) => createElement(View, props),
  };
});

function renderPicker(value: string | null, error?: string) {
  const onChange = jest.fn();
  return renderUi(
    <Field label="Prazo" error={error}>
      <DatePickerField testID="due" value={value} onChange={onChange} />
    </Field>,
  ).then(() => onChange);
}

describe('DatePickerField', () => {
  it('AC-04.12.1 is a button named by its field and the placeholder', async () => {
    await renderPicker(null);
    const button = screen.getByRole('button', {
      name: 'Prazo, Selecione uma data',
    });
    expectTouchTarget(button, { width: false });
    expect(styleOf(screen.getByText('Selecione uma data')).color).toBe(
      token('fg-subtle'),
    );
    expect(screen.queryByRole('button', { name: 'Remover prazo' })).toBeNull();
  });

  it('AC-04.7.4 picks a calendar date without shifting it', async () => {
    const onChange = await renderPicker(null);
    await fireEvent.press(screen.getByTestId('due'));
    await fireEvent(
      screen.getByTestId('due-picker'),
      'change',
      { type: 'set' },
      new Date(2026, 9, 31, 23, 59),
    );
    expect(onChange).toHaveBeenCalledWith('2026-10-31');
    expect(screen.queryByTestId('due-picker')).toBeNull();
  });

  it('closes without a change when dismissed', async () => {
    const onChange = await renderPicker('2026-10-31');
    await fireEvent.press(screen.getByTestId('due'));
    await fireEvent(screen.getByTestId('due-picker'), 'change', {
      type: 'dismissed',
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('due-picker')).toBeNull();
  });

  it('AC-04.7.4 shows the long pt-BR date and clears it', async () => {
    const onChange = await renderPicker('2026-10-31');
    expect(
      screen.getByRole('button', {
        name: 'Prazo, sábado, 31 de outubro de 2026',
      }),
    ).toBeTruthy();
    const clear = screen.getByRole('button', { name: 'Remover prazo' });
    expectTouchTarget(clear);
    await fireEvent.press(clear);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('outlines the field in danger when invalid', async () => {
    await renderPicker(null, 'Informe uma data válida');
    expect(styleOf(screen.getByTestId('due')).borderColor).toBe(
      token('danger'),
    );
  });
});
