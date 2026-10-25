import type { TaskResponseDto } from '@hitss/api-client';
import { Text, View } from 'react-native';

import { Icon } from '@/ui';

import { dueLabel } from '../format';

export interface DueDateProps {
  task: Pick<TaskResponseDto, 'dueDate' | 'isOverdue'>;
  style?: 'short' | 'long';
  emptyLabel?: string;
}

export function DueDate({ task, style = 'short', emptyLabel }: DueDateProps) {
  const label = dueLabel(task, style);
  if (!label) {
    return emptyLabel ? <Text className="type-meta">{emptyLabel}</Text> : null;
  }
  return (
    <View className="flex-row items-center gap-1">
      <Icon
        name={task.isOverdue ? 'alert-triangle' : 'calendar'}
        color={task.isOverdue ? 'warning' : 'fg-subtle'}
        size={14}
        testID={task.isOverdue ? 'overdue-icon' : undefined}
      />
      <Text className={task.isOverdue ? 'type-meta text-warning' : 'type-meta'}>
        {label}
      </Text>
    </View>
  );
}
