import type { TaskResponseDto, TaskStatus } from '@hitss/api-client';
import { AccessibilityInfo } from 'react-native';

import { showToast, statusLabels } from '@/ui';

import { useChangeTaskStatus } from './useTaskMutations';

export function useStatusChange() {
  const mutation = useChangeTaskStatus();

  function change(
    task: Pick<TaskResponseDto, 'id' | 'status' | 'title'>,
    status: TaskStatus,
  ) {
    if (status === task.status) {
      return;
    }
    const previous = task.status;
    mutation.mutate(
      { id: task.id, status, title: task.title },
      {
        onSuccess: () => {
          AccessibilityInfo.announceForAccessibility(
            `Status alterado para ${statusLabels[status]}`,
          );
          showToast({
            message: `Marcada como ${statusLabels[status]}`,
            action: {
              label: 'Desfazer',
              onPress: () =>
                mutation.mutate({
                  id: task.id,
                  status: previous,
                  title: task.title,
                }),
            },
          });
        },
      },
    );
  }

  return { change, pending: mutation.isPending };
}
