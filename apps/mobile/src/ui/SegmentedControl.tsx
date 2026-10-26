import { Pressable, ScrollView, Text, View } from 'react-native';

import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  scrollable?: boolean;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  scrollable = false,
  testID,
}: SegmentedControlProps<T>) {
  const group = (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className={cx('segmented', scrollable && 'grow')}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID && `${testID}-${option.value}`}
            onPress={() => {
              if (!active) {
                onChange(option.value);
              }
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active, checked: active, disabled }}
            className={cx(
              scrollable ? 'segment-fit' : 'segment',
              'min-w-touch',
              active && 'segment-active',
              disabled && 'btn-disabled',
            )}
          >
            {option.icon && (
              <Icon
                name={option.icon}
                color={active ? 'on-primary' : 'fg'}
                size={16}
              />
            )}
            <Text
              className={active ? 'segment-label-active' : 'segment-label'}
              numberOfLines={scrollable ? 1 : 2}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  if (!scrollable) {
    return group;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-4"
      contentContainerClassName="grow px-4"
    >
      {group}
    </ScrollView>
  );
}
