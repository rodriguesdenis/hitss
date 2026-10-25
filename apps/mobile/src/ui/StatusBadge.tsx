import type { TaskStatus } from '@hitss/api-client';
import { Text, View } from 'react-native';

import type { ColorRole } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

export const statusLabels: Record<TaskStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
};

export const statusIcons: Record<TaskStatus, IconName> = {
  PENDING: 'circle',
  IN_PROGRESS: 'circle-half',
  DONE: 'check-circle',
};

const badgeClass: Record<TaskStatus, string> = {
  PENDING: 'badge-status-pending',
  IN_PROGRESS: 'badge-status-in_progress',
  DONE: 'badge-status-done',
};

const labelClass: Record<TaskStatus, string> = {
  PENDING: 'badge-status-pending-label',
  IN_PROGRESS: 'badge-status-in_progress-label',
  DONE: 'badge-status-done-label',
};

const iconColor: Record<TaskStatus, ColorRole> = {
  PENDING: 'status-pending-fg',
  IN_PROGRESS: 'status-progress-fg',
  DONE: 'status-done-fg',
};

export interface StatusBadgeProps {
  status: TaskStatus;
  iconOnly?: boolean;
  testID?: string;
}

export function StatusBadge({
  status,
  iconOnly = false,
  testID,
}: StatusBadgeProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={statusLabels[status]}
      className={badgeClass[status]}
    >
      <Icon name={statusIcons[status]} color={iconColor[status]} size={14} />
      {!iconOnly && (
        <Text className={labelClass[status]} maxFontSizeMultiplier={1.5}>
          {statusLabels[status]}
        </Text>
      )}
    </View>
  );
}
