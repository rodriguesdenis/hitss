import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

function useAccessibilityFlag(
  event: 'reduceMotionChanged' | 'screenReaderChanged',
  read: () => Promise<boolean>,
): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void read().then((value) => {
      if (active) {
        setEnabled(value);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(event, setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [event, read]);
  return enabled;
}

export function useReduceMotion(): boolean {
  return useAccessibilityFlag(
    'reduceMotionChanged',
    AccessibilityInfo.isReduceMotionEnabled,
  );
}

export function useScreenReader(): boolean {
  return useAccessibilityFlag(
    'screenReaderChanged',
    AccessibilityInfo.isScreenReaderEnabled,
  );
}
