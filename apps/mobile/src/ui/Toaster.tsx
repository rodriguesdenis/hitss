import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScreenReader } from './a11y';
import { Toast } from './Toast';
import { useToastStore, type Toast as ToastModel } from './toast.store';

export const TOAST_MS = 4000;
export const ERROR_TOAST_MS = 6000;
export const SCREEN_READER_ACTION_TOAST_MS = 8000;

export function toastDuration(
  toast: Pick<ToastModel, 'tone' | 'action'>,
  screenReader: boolean,
): number {
  if (toast.action && screenReader) {
    return SCREEN_READER_ACTION_TOAST_MS;
  }
  return toast.tone === 'error' ? ERROR_TOAST_MS : TOAST_MS;
}

export interface ToasterProps {
  offset?: number;
}

export function Toaster({ offset = 0 }: ToasterProps) {
  const current = useToastStore((state) => state.current);
  const hide = useToastStore((state) => state.hide);
  const screenReader = useScreenReader();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (current) {
      AccessibilityInfo.announceForAccessibility(current.message);
    }
  }, [current]);

  useEffect(() => {
    if (!current) {
      return;
    }
    const timer = setTimeout(
      () => hide(current.id),
      toastDuration(current, screenReader),
    );
    return () => clearTimeout(timer);
  }, [current, screenReader, hide]);

  if (!current) {
    return null;
  }
  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0"
      style={{ paddingBottom: insets.bottom + offset }}
    >
      <Toast
        testID="toast"
        message={current.message}
        action={current.action}
        onAction={() => hide(current.id)}
      />
    </View>
  );
}
