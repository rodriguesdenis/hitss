import { useEffect, useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, Modal, Pressable, Text, View } from 'react-native';

import { useReduceMotion } from './a11y';
import { Button } from './Button';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const reduceMotion = useReduceMotion();
  const cancelRef = useRef<ComponentRef<typeof Pressable>>(null);

  useEffect(() => {
    if (visible && cancelRef.current) {
      AccessibilityInfo.sendAccessibilityEvent(cancelRef.current, 'focus');
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-center">
        <View className="scrim" />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onCancel}
          className="dialog"
        >
          <Text className="type-headline" accessibilityRole="header">
            {title}
          </Text>
          {message && <Text className="type-muted">{message}</Text>}
          <View className="flex-row flex-wrap justify-end gap-3">
            <Button
              ref={cancelRef}
              label={cancelLabel}
              variant="secondary"
              onPress={onCancel}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
