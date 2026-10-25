import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';

import { useReduceMotion } from './a11y';

export const PROGRESS_PULSE_MS = 1200;

export interface ProgressBarProps {
  visible: boolean;
  label: string;
}

export function ProgressBar({ visible, label }: ProgressBarProps) {
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!visible || reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const half = PROGRESS_PULSE_MS / 2;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: half,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: half,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reduceMotion, visible]);
  if (!visible) {
    return <View className="h-0.5" />;
  }
  return (
    <Animated.View
      testID="progress-bar"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      className="h-0.5 bg-primary"
      style={{ opacity }}
    />
  );
}
