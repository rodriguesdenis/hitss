import { Text, View } from 'react-native';

import { Icon } from '@/ui';

import { usePendingSync } from '../use-pending-sync';

export const PENDING_LABEL = 'Sincronização pendente';

export function PendingSyncBadge({ id }: { id: string }) {
  const { has } = usePendingSync();
  if (!has(id)) {
    return null;
  }
  return (
    <View testID={`pending-sync-${id}`} className="badge-pending-sync">
      <Icon name="clock" color="on-info-soft" size={12} />
      <Text className="badge-pending-sync-label">{PENDING_LABEL}</Text>
    </View>
  );
}
