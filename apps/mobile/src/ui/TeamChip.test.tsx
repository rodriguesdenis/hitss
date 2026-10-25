import {
  expectTouchTarget,
  fireEvent,
  renderUi,
  rgba,
  screen,
  styleOf,
  token,
} from '../../tests/renderUi';

import { TeamChip } from './TeamChip';
import { TeamChipGroup } from './TeamChipGroup';

const hidden = { includeHiddenElements: true };

const team = (name: string, colorHex = '#7C3AED') => ({
  id: `team-${name.toLowerCase()}`,
  name,
  colorHex,
});

describe('TeamChip', () => {
  it('AC-04.8.1 shows the team name on the team color', async () => {
    await renderUi(<TeamChip testID="chip" name="Mobile" colorHex="#7C3AED" />);
    expect(styleOf(screen.getByTestId('chip')).backgroundColor).toBe('#7C3AED');
    expect(screen.getByText('Mobile')).toBeTruthy();
  });

  it.each([
    ['#7C3AED', '#FFFFFF'],
    ['#0EA5E9', '#000000'],
    ['#EAB308', '#000000'],
    ['#1E293B', '#FFFFFF'],
    ['#FFFFFF', '#000000'],
    ['#000000', '#FFFFFF'],
  ])('AC-04.8.2 picks the readable text for %s', async (color, text) => {
    await renderUi(<TeamChip name="Time" colorHex={color} />);
    expect(styleOf(screen.getByText('Time')).color).toBe(text);
  });

  it.each([
    ['light', '#EAB308', true],
    ['light', '#7C3AED', false],
    ['dark', '#1E293B', true],
    ['dark', '#EAB308', false],
  ] as const)(
    'AC-04.8.2 in %s, %s has an outline: %s',
    async (scheme, color, outlined) => {
      await renderUi(<TeamChip testID="chip" name="Time" colorHex={color} />, {
        scheme,
      });
      const style = styleOf(screen.getByTestId('chip'));
      if (outlined) {
        expect(style).toMatchObject({
          borderWidth: 1,
          borderColor: token('border-strong', scheme),
        });
      } else {
        expect(style.borderWidth).toBeUndefined();
      }
    },
  );

  it('AC-04.12.1 a pressable chip is a named button with a 44 pt target', async () => {
    const onPress = jest.fn();
    await renderUi(
      <TeamChip
        name="QA"
        colorHex="#7C3AED"
        onPress={onPress}
        accessibilityHint="Mostra as tarefas deste time"
      />,
    );
    const chip = screen.getByRole('button', { name: 'QA' });
    expectTouchTarget(chip);
    expect(chip.props.accessibilityHint).toBe('Mostra as tarefas deste time');
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('AC-04.12.5 shows selection with a check icon and checked state, not color alone', async () => {
    const { rerender } = await renderUi(
      <TeamChip
        name="Design"
        colorHex="#EC4899"
        selected={false}
        onPress={jest.fn()}
      />,
    );
    let chip = screen.getByRole('checkbox', { name: 'Design' });
    expect(chip).not.toBeChecked();
    expect(styleOf(chip).backgroundColor).toBeUndefined();
    expect(styleOf(chip).borderColor).toBe(token('border-strong'));
    expect(styleOf(screen.getByText('Design')).color).toBe(token('fg'));
    expectTouchTarget(chip);

    await rerender(
      <TeamChip
        name="Design"
        colorHex="#EC4899"
        selected
        onPress={jest.fn()}
      />,
    );
    chip = screen.getByRole('checkbox', { name: 'Design' });
    expect(chip).toBeChecked();
    expect(styleOf(chip).backgroundColor).toBe('#EC4899');
    expect(screen.getByTestId('team-chip-check', hidden).props.iconName).toBe(
      'check',
    );
  });

  it('AC-04.7.4 a disabled chip cannot be selected', async () => {
    const onPress = jest.fn();
    await renderUi(
      <TeamChip
        name="Ops"
        colorHex="#64748B"
        selected={false}
        disabled
        onPress={onPress}
      />,
    );
    const chip = screen.getByRole('checkbox', { name: 'Ops' });
    expect(chip).toBeDisabled();
    await fireEvent.press(chip);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TeamChipGroup', () => {
  const five = ['Mobile', 'Backend', 'Design', 'Platform', 'QA'].map((name) =>
    team(name),
  );

  it('AC-04.8.3 lists show 3 chips and +N', async () => {
    await renderUi(<TeamChipGroup teams={five} />);
    expect(screen.getByText('Mobile', hidden)).toBeTruthy();
    expect(screen.getByText('Design', hidden)).toBeTruthy();
    expect(screen.queryByText('Platform', hidden)).toBeNull();
    const overflow = screen.getByText('+2', hidden);
    expect(styleOf(overflow).color).toBe(token('fg-muted'));
  });

  it('AC-04.8.3 the detail shows every chip', async () => {
    await renderUi(<TeamChipGroup teams={five} variant="detail" />);
    for (const { name } of five) {
      expect(screen.getByText(name, hidden)).toBeTruthy();
    }
    expect(screen.queryByText(/^\+/, hidden)).toBeNull();
  });

  it('AC-04.8.5 is announced as one element "Times: …"', async () => {
    await renderUi(
      <TeamChipGroup teams={[team('Mobile'), team('Backend', '#0EA5E9')]} />,
    );
    expect(
      screen.getByLabelText('Times: Mobile, Backend').props.accessible,
    ).toBe(true);
  });

  it('AC-04.8.5 names every team even when some are behind +N', async () => {
    await renderUi(<TeamChipGroup teams={five} />);
    expect(
      screen.getByLabelText('Times: Mobile, Backend, Design, Platform, QA'),
    ).toBeTruthy();
  });

  it('AC-04.8.4 renders nothing in lists and "Sem times" in the detail', async () => {
    const { rerender, toJSON } = await renderUi(<TeamChipGroup teams={[]} />);
    expect(screen.queryByText('Sem times')).toBeNull();
    expect(JSON.stringify(toJSON())).not.toContain('Times:');
    await rerender(<TeamChipGroup teams={[]} variant="detail" />);
    expect(screen.getByText('Sem times')).toBeTruthy();
  });

  it('AC-04.8.1 detail chips open the team when pressed', async () => {
    const onPressTeam = jest.fn();
    const mobile = team('Mobile');
    await renderUi(
      <TeamChipGroup
        teams={[mobile]}
        variant="detail"
        onPressTeam={onPressTeam}
        teamHint="Mostra as tarefas deste time"
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Mobile' }));
    expect(onPressTeam).toHaveBeenCalledWith(mobile);
  });

  it('keeps the team color as the chip background', async () => {
    await renderUi(<TeamChipGroup teams={[team('Backend', '#0EA5E9')]} />);
    const label = screen.getByText('Backend', hidden);
    expect(styleOf(label.parent!).backgroundColor).toBe('#0EA5E9');
    expect(rgba('#0EA5E9')).toBe('rgba(14, 165, 233, 1)');
  });
});
