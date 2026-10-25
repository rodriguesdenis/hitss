import { Pressable, Text, View } from 'react-native';

import { contrastingText, needsOutline } from '@/theme/contrast';
import { useColorSchemeName } from '@/theme/ThemeProvider';
import { tokens } from '@/theme/tokens';

import { cx } from './cx';
import { Icon } from './Icon';

const CHIP_HIT_SLOP = { top: 10, bottom: 10 };

export interface TeamChipProps {
  name: string;
  colorHex: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
  testID?: string;
}

export function TeamChip({
  name,
  colorHex,
  selected,
  disabled = false,
  onPress,
  accessibilityHint,
  testID,
}: TeamChipProps) {
  const scheme = useColorSchemeName();
  const selectable = selected !== undefined;
  const filled = !selectable || selected;
  const text = contrastingText(colorHex);
  const outlined = !filled || needsOutline(colorHex, tokens[scheme].surface);
  const content = (
    <>
      {selectable &&
        (selected ? (
          <Icon name="check" color={text} size={14} testID="team-chip-check" />
        ) : (
          <View
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: colorHex }}
          />
        ))}
      <Text
        numberOfLines={1}
        className={cx('chip-label', !filled && 'text-fg')}
        style={filled ? { color: text } : undefined}
      >
        {name}
      </Text>
    </>
  );
  const className = cx(
    'chip',
    selectable && 'gap-1',
    outlined && 'chip-outline',
    onPress && 'min-w-touch justify-center',
    disabled && 'btn-disabled',
  );
  const style = filled ? { backgroundColor: colorHex } : undefined;
  if (!onPress) {
    return (
      <View testID={testID} className={className} style={style}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityLabel={name}
      accessibilityHint={accessibilityHint}
      accessibilityState={
        selectable ? { checked: selected, disabled } : { disabled }
      }
      className={className}
      style={style}
    >
      {content}
    </Pressable>
  );
}
