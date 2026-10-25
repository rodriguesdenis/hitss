import type { TaskResponseDto } from '@hitss/api-client';
import { Pressable, Text, View } from 'react-native';

import { StatusBadge, TeamChipGroup } from '@/ui';

import { taskAccessibilityLabel } from '../format';
import { DueDate } from './DueDate';

export interface TaskRowProps {
  task: TaskResponseDto;
  onPress: () => void;
  onLongPress: () => void;
}

export function TaskRow({ task, onPress, onLongPress }: TaskRowProps) {
  return (
    <Pressable
      testID={`task-${task.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={taskAccessibilityLabel(task)}
      accessibilityHint="Abre os detalhes da tarefa"
      accessibilityActions={[{ name: 'longpress', label: 'Alterar status' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'longpress') {
          onLongPress();
        }
      }}
      className="list-item"
    >
      <View className="flex-row items-start gap-2">
        <Text
          numberOfLines={2}
          className={
            task.status === 'DONE'
              ? 'type-headline flex-1 text-fg-muted'
              : 'type-headline flex-1'
          }
        >
          {task.title}
        </Text>
        <StatusBadge status={task.status} iconOnly />
      </View>
      <TeamChipGroup teams={task.teams} />
      <DueDate task={task} />
    </Pressable>
  );
}
