import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from './a11y';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: SheetProps) {
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="scrim"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          className="sheet"
          style={{ paddingBottom: insets.bottom + 32 }}
        >
          <View className="sheet-handle" />
          {title && (
            <Text className="type-headline" accessibilityRole="header">
              {title}
            </Text>
          )}
          {children}
        </View>
      </View>
    </Modal>
  );
}

export interface SheetOptionProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  destructive?: boolean;
  selected?: boolean;
  testID?: string;
}

export function SheetOption({
  label,
  onPress,
  icon,
  destructive = false,
  selected,
  testID,
}: SheetOptionProps) {
  const selectable = selected !== undefined;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={selectable ? 'radio' : 'button'}
      accessibilityLabel={label}
      accessibilityState={selectable ? { selected, checked: selected } : {}}
      className="sheet-option"
    >
      {icon && <Icon name={icon} color={destructive ? 'danger' : 'fg'} />}
      <Text className={cx('type-body flex-1', destructive && 'text-danger')}>
        {label}
      </Text>
      {selected && <Icon name="check" color="primary" />}
    </Pressable>
  );
}
