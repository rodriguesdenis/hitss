import { Text, View } from 'react-native';

import { Icon } from './Icon';

export type ConnectivityStatus = 'offline' | 'syncing' | 'synced';

export interface OfflineBannerProps {
  status?: ConnectivityStatus;
  pendingCount?: number;
}

function content(status: ConnectivityStatus, pendingCount: number) {
  switch (status) {
    case 'offline':
      return {
        icon: 'wifi-off',
        color: 'warning',
        message:
          'Você está offline. As alterações serão sincronizadas ao reconectar.',
      } as const;
    case 'syncing':
      return {
        icon: 'clock',
        color: 'fg',
        message: `De volta online — sincronizando ${pendingCount} alterações…`,
      } as const;
    case 'synced':
      return {
        icon: 'check-circle',
        color: 'success',
        message: 'Todas as alterações sincronizadas',
      } as const;
  }
}

export function OfflineBanner({
  status,
  pendingCount = 0,
}: OfflineBannerProps) {
  if (!status) {
    return null;
  }
  const { icon, color, message } = content(status, pendingCount);
  return (
    <View
      testID="offline-banner"
      accessibilityLiveRegion="polite"
      className="banner-offline"
    >
      <Icon name={icon} color={color} />
      <Text className="type-muted flex-1 text-fg">{message}</Text>
    </View>
  );
}
