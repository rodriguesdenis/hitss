import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { useColorSchemeName } from '@/theme/ThemeProvider';
import { tokens, type ColorRole } from '@/theme/tokens';

const glyphs = {
  'alert-circle': 'alert-circle-outline',
  'alert-triangle': 'alert-outline',
  calendar: 'calendar-blank-outline',
  check: 'check',
  'check-circle': 'check-circle',
  'check-square': 'checkbox-marked-outline',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  circle: 'circle-outline',
  'circle-half': 'circle-half-full',
  clock: 'clock-outline',
  close: 'close',
  'cloud-off': 'cloud-off-outline',
  edit: 'pencil-outline',
  eye: 'eye-outline',
  'eye-off': 'eye-off-outline',
  logout: 'logout',
  more: 'dots-horizontal',
  plus: 'plus',
  search: 'magnify',
  settings: 'cog-outline',
  sort: 'swap-vertical',
  trash: 'trash-can-outline',
  users: 'account-group-outline',
  'wifi-off': 'wifi-off',
} as const satisfies Record<
  string,
  ComponentProps<typeof MaterialCommunityIcons>['name']
>;

export type IconName = keyof typeof glyphs;

export type IconColor = ColorRole | `#${string}`;

export interface IconProps {
  name: IconName;
  color?: IconColor;
  size?: number;
  testID?: string;
}

export function Icon({ name, color = 'fg', size = 20, testID }: IconProps) {
  const scheme = useColorSchemeName();
  return (
    <MaterialCommunityIcons
      name={glyphs[name]}
      size={size}
      color={color.startsWith('#') ? color : tokens[scheme][color as ColorRole]}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
