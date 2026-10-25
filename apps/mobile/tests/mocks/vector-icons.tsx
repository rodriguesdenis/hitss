import { View, type ViewProps } from 'react-native';

type IconProps = ViewProps & { name: string; color?: string; size?: number };

export default function MockIcon({ name, color, size, ...props }: IconProps) {
  return (
    <View
      {...props}
      {...{ iconName: name, iconColor: color, iconSize: size }}
    />
  );
}
