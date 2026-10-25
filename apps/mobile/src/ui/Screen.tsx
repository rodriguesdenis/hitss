import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

export interface ScreenProps {
  children: ReactNode;
  padded?: boolean;
  edges?: readonly Edge[];
  testID?: string;
}

export function Screen({
  children,
  padded = false,
  edges = ['top'],
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const inset = (edge: Edge) => (edges.includes(edge) ? insets[edge] : 0);
  return (
    <View
      testID={testID}
      className="screen"
      style={{
        paddingTop: inset('top'),
        paddingBottom: inset('bottom'),
        paddingLeft: inset('left'),
        paddingRight: inset('right'),
      }}
    >
      {padded ? <View className="screen-padded">{children}</View> : children}
    </View>
  );
}
