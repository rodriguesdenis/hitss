import type { TeamResponseDto } from '@hitss/api-client';

import { Sheet, SheetOption } from '@/ui';

export interface TeamOptionsSheetProps {
  team?: TeamResponseDto;
  onClose: () => void;
  onEdit: (team: TeamResponseDto) => void;
  onDelete: (team: TeamResponseDto) => void;
}

export function TeamOptionsSheet({
  team,
  onClose,
  onEdit,
  onDelete,
}: TeamOptionsSheetProps) {
  return (
    <Sheet visible={team !== undefined} title={team?.name} onClose={onClose}>
      {team && (
        <>
          <SheetOption
            label="Editar time"
            icon="edit"
            onPress={() => {
              onClose();
              onEdit(team);
            }}
          />
          <SheetOption
            label="Excluir time"
            icon="trash"
            destructive
            onPress={() => {
              onClose();
              onDelete(team);
            }}
          />
        </>
      )}
    </Sheet>
  );
}
