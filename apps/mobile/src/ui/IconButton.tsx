import { Pressable } from 'react-native';

import { cx } from './cx';
import { Icon, type IconColor, type IconName } from './Icon';

export interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: IconColor;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

export function IconButton({
  icon,
  label,
  onPress,
  color = 'fg',
  disabled = false,
  accessibilityHint,
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      className={cx('icon-btn', disabled && 'btn-disabled')}
    >
      <Icon name={icon} color={color} size={22} />
    </Pressable>
  );
}
