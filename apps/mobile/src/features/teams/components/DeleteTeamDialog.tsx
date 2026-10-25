import type { TeamResponseDto } from '@hitss/api-client';

import { ConfirmDialog } from '@/ui';

import { useDeleteTeam } from '../hooks/useTeamMutations';

export interface DeleteTeamDialogProps {
  team?: Pick<TeamResponseDto, 'id' | 'name'>;
  onCancel: () => void;
  onDeleted?: () => void;
}

export function DeleteTeamDialog({
  team,
  onCancel,
  onDeleted,
}: DeleteTeamDialogProps) {
  const remove = useDeleteTeam();
  return (
    <ConfirmDialog
      visible={team !== undefined}
      title={`Excluir “${team?.name ?? ''}”?`}
      message="As tarefas serão mantidas e deixarão de estar atribuídas a este time."
      confirmLabel="Excluir"
      onCancel={onCancel}
      onConfirm={() => {
        if (!team || remove.isPending) {
          return;
        }
        remove.mutate(
          { id: team.id, name: team.name },
          { onSuccess: onDeleted },
        );
        onCancel();
      }}
    />
  );
}
