import type { ComponentRef, Ref } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { useColorSchemeName } from '@/theme/ThemeProvider';
import { tokens, type ColorRole } from '@/theme/tokens';

import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type ButtonVariant =
  'primary' | 'secondary' | 'danger' | 'ghost' | 'ghost-danger';

const containerClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
  'ghost-danger': 'btn-ghost',
};

const labelClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary-label',
  secondary: 'btn-secondary-label',
  danger: 'btn-danger-label',
  ghost: 'btn-ghost-label',
  'ghost-danger': 'btn-ghost-danger-label',
};

const contentColor: Record<ButtonVariant, ColorRole> = {
  primary: 'on-primary',
  secondary: 'fg',
  danger: 'on-danger',
  ghost: 'primary',
  'ghost-danger': 'danger',
};

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  accessibilityHint?: string;
  className?: string;
  testID?: string;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  loadingLabel,
  disabled = false,
  accessibilityHint,
  className,
  testID,
  ref,
}: ButtonProps) {
  const scheme = useColorSchemeName();
  const color = contentColor[variant];
  const text = loading && loadingLabel ? loadingLabel : label;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={cx(
        containerClass[variant],
        disabled && 'btn-disabled',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator color={tokens[scheme][color]} />
      ) : (
        icon && <Icon name={icon} color={color} />
      )}
      <Text className={labelClass[variant]}>{text}</Text>
    </Pressable>
  );
}
