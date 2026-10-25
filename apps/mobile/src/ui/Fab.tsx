import { Pressable } from 'react-native';

import { Icon, type IconName } from './Icon';

export interface FabProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  testID?: string;
}

export function Fab({ label, onPress, icon = 'plus', testID }: FabProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="fab"
    >
      <Icon name={icon} color="on-primary" size={28} />
    </Pressable>
  );
}
