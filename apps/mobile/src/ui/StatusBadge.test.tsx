import type { TaskStatus } from '@hitss/api-client';
import { useState } from 'react';
import type { TestInstance } from 'test-renderer';

import {
  expectTouchTarget,
  fireEvent,
  renderUi,
  screen,
  styleOf,
  token,
} from '../../tests/renderUi';

import { SegmentedControl } from './SegmentedControl';
import { StatusBadge, statusIcons, statusLabels } from './StatusBadge';

const hidden = { includeHiddenElements: true };

describe('StatusBadge', () => {
  it.each([
    ['PENDING', 'Pendente', 'circle-outline', 'pending'],
    ['IN_PROGRESS', 'Em andamento', 'circle-half-full', 'progress'],
    ['DONE', 'Concluída', 'check-circle', 'done'],
  ] as const)(
    'AC-04.12.5 renders %s with an icon and the label "%s"',
    async (status, label, glyph, tone) => {
      for (const scheme of ['light', 'dark'] as const) {
        await renderUi(<StatusBadge testID="badge" status={status} />, {
          scheme,
        });
        const badge = screen.getByLabelText(label);
        expect(styleOf(badge).backgroundColor).toBe(
          token(`status-${tone}-bg`, scheme),
        );
        expect(styleOf(screen.getByText(label, hidden)).color).toBe(
          token(`status-${tone}-fg`, scheme),
        );
        expect((badge.children[0] as TestInstance).props.iconName).toBe(glyph);
      }
    },
  );

  it('AC-04.12.5 keeps the label for screen readers when icon-only', async () => {
    await renderUi(<StatusBadge status="IN_PROGRESS" iconOnly />);
    expect(screen.getByLabelText('Em andamento')).toBeTruthy();
    expect(screen.queryByText('Em andamento', hidden)).toBeNull();
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'ALL', label: 'Todas' },
    ...(['PENDING', 'IN_PROGRESS', 'DONE'] as const).map((status) => ({
      value: status,
      label: statusLabels[status],
      icon: statusIcons[status],
    })),
  ] as const;

  function Harness({
    onChange,
    scrollable,
  }: {
    onChange: (value: string) => void;
    scrollable?: boolean;
  }) {
    const [value, setValue] = useState<'ALL' | TaskStatus>('ALL');
    return (
      <SegmentedControl
        label="Filtrar por status"
        scrollable={scrollable}
        options={options}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }

  it('AC-04.5.1 is a radiogroup with exactly one selected radio', async () => {
    await renderUi(<Harness onChange={jest.fn()} />);
    expect(
      screen.getByLabelText('Filtrar por status').props.accessibilityRole,
    ).toBe('radiogroup');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(
      radios.filter((radio) => radio.props.accessibilityState.selected),
    ).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Todas' })).toBeSelected();
    radios.forEach((radio) => expectTouchTarget(radio));
  });

  it('AC-04.5.1 selecting a segment replaces the previous one', async () => {
    const onChange = jest.fn();
    await renderUi(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Concluída' }));
    expect(onChange).toHaveBeenCalledWith('DONE');
    expect(screen.getByRole('radio', { name: 'Concluída' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Todas' })).not.toBeSelected();
    expect(
      styleOf(screen.getByRole('radio', { name: 'Concluída' })).backgroundColor,
    ).toBe(token('primary'));
    expect(styleOf(screen.getByText('Concluída', hidden)).color).toBe(
      token('on-primary'),
    );
  });

  it('keeps every label on one line when scrollable', async () => {
    const onChange = jest.fn();
    await renderUi(<Harness onChange={onChange} scrollable />);
    expect(screen.getByText('Em andamento', hidden).props.numberOfLines).toBe(
      1,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Em andamento' }));
    expect(onChange).toHaveBeenCalledWith('IN_PROGRESS');
    expect(screen.getByRole('radio', { name: 'Em andamento' })).toBeSelected();
  });

  it('tapping the active segment does nothing', async () => {
    const onChange = jest.fn();
    await renderUi(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Todas' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
