import { Pressable, Text, View } from 'react-native';

import type { ToastAction } from './toast.store';

export interface ToastProps {
  message: string;
  action?: ToastAction;
  onAction?: () => void;
  testID?: string;
}

export function Toast({ message, action, onAction, testID }: ToastProps) {
  return (
    <View testID={testID} accessibilityLiveRegion="polite" className="toast">
      <Text className="toast-label">{message}</Text>
      {action && (
        <Pressable
          onPress={() => {
            action.onPress();
            onAction?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          className="toast-action min-w-touch items-center"
        >
          <Text className="text-label text-inverse-action">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
