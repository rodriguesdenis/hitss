import { Pressable, View } from 'react-native';

import { contrastingText, needsOutline } from '@/theme/contrast';
import { useColorSchemeName } from '@/theme/ThemeProvider';
import { tokens } from '@/theme/tokens';
import { Icon } from '@/ui';

import { teamPalette } from '../palette';

export interface ColorSwatchGridProps {
  value: string | null;
  onSelect: (hex: string) => void;
  disabled?: boolean;
}

export function ColorSwatchGrid({
  value,
  onSelect,
  disabled = false,
}: ColorSwatchGridProps) {
  const scheme = useColorSchemeName();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Cor"
      className="flex-row flex-wrap gap-2"
    >
      {teamPalette.map(({ name, hex }) => {
        const selected = value === hex;
        const outlined = needsOutline(hex, tokens[scheme].surface);
        return (
          <Pressable
            key={hex}
            testID={`swatch-${hex}`}
            onPress={() => onSelect(hex)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={`${name}, ${hex}`}
            accessibilityState={{ selected, checked: selected, disabled }}
            className={
              selected
                ? 'h-touch w-touch items-center justify-center rounded-full border-2 border-focus'
                : 'h-touch w-touch items-center justify-center rounded-full'
            }
          >
            <View
              className={
                outlined
                  ? 'h-9 w-9 items-center justify-center rounded-full border border-border-strong'
                  : 'h-9 w-9 items-center justify-center rounded-full'
              }
              style={{ backgroundColor: hex }}
            >
              {selected && (
                <Icon name="check" color={contrastingText(hex)} size={18} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
