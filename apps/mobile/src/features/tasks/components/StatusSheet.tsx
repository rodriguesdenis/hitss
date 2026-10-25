import type { TaskResponseDto, TaskStatus } from '@hitss/api-client';

import { Sheet, SheetOption, statusIcons, statusLabels } from '@/ui';

import { useStatusChange } from '../hooks/useStatusChange';

const statuses: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE'];

export interface StatusSheetProps {
  task?: TaskResponseDto;
  onClose: () => void;
}

export function StatusSheet({ task, onClose }: StatusSheetProps) {
  const { change } = useStatusChange();
  return (
    <Sheet
      testID="status-sheet"
      visible={task !== undefined}
      title="Alterar status"
      onClose={onClose}
    >
      {task &&
        statuses.map((status) => (
          <SheetOption
            key={status}
            label={statusLabels[status]}
            icon={statusIcons[status]}
            selected={task.status === status}
            onPress={() => {
              onClose();
              change(task, status);
            }}
          />
        ))}
    </Sheet>
  );
}
