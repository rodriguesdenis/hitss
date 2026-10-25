import { useEffect, useState } from 'react';
import { Animated, View, type DimensionValue } from 'react-native';

import { useReduceMotion } from './a11y';
import { cx } from './cx';

export const SHIMMER_MS = 1200;

export interface SkeletonProps {
  width?: DimensionValue;
  shape?: 'line' | 'chip';
}

export function Skeleton({ width = '100%', shape = 'line' }: SkeletonProps) {
  return (
    <View
      className={cx(
        shape === 'line' ? 'skeleton-line' : 'skeleton h-chip rounded-sm',
      )}
      style={{ width }}
    />
  );
}

function TaskRowSkeleton() {
  return (
    <View className="skeleton-row">
      <Skeleton width="60%" />
      <View className="flex-row gap-2">
        <Skeleton shape="chip" width={48} />
        <Skeleton shape="chip" width={48} />
      </View>
      <Skeleton width="30%" />
    </View>
  );
}

function TeamRowSkeleton() {
  return (
    <View className="skeleton-row flex-row">
      <View className="skeleton w-1 self-stretch" />
      <View className="flex-1 gap-2 justify-center">
        <Skeleton width="40%" />
        <Skeleton width="25%" />
      </View>
    </View>
  );
}

export interface SkeletonListProps {
  label: string;
  variant?: 'task' | 'team';
  count?: number;
}

export function SkeletonList({
  label,
  variant = 'task',
  count = variant === 'task' ? 6 : 5,
}: SkeletonListProps) {
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const half = SHIMMER_MS / 2;
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
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
    shimmer.start();
    return () => shimmer.stop();
  }, [opacity, reduceMotion]);
  const Row = variant === 'task' ? TaskRowSkeleton : TeamRowSkeleton;
  return (
    <Animated.View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      className="gap-2"
      style={{ opacity }}
    >
      {Array.from({ length: count }, (_, index) => (
        <Row key={index} />
      ))}
    </Animated.View>
  );
}
