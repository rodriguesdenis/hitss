import type { TeamResponseDto } from '@hitss/api-client';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { taskCountLabel } from '@/features/teams';
import { IconButton, Sheet, SheetOption } from '@/ui';

export interface TeamTasksHeaderProps {
  team: TeamResponseDto;
  onBack: () => void;
  onEditTeam: () => void;
  onShowAll: () => void;
}

export function TeamTasksHeader({
  team,
  onBack,
  onEditTeam,
  onShowAll,
}: TeamTasksHeaderProps) {
  const [options, setOptions] = useState(false);
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-1">
        <IconButton icon="chevron-left" label="Voltar" onPress={onBack} />
        <View
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: team.colorHex }}
        />
        <Text
          className="type-title flex-1"
          numberOfLines={2}
          accessibilityRole="header"
        >
          {team.name}
        </Text>
        <IconButton
          icon="more"
          label={`Opções do time ${team.name}`}
          onPress={() => setOptions(true)}
        />
      </View>
      <Text className="type-meta pl-touch">
        {taskCountLabel(team.taskCount)}
      </Text>
      <Sheet
        visible={options}
        title={team.name}
        onClose={() => setOptions(false)}
      >
        <SheetOption
          label="Editar time"
          icon="edit"
          onPress={() => {
            setOptions(false);
            onEditTeam();
          }}
        />
        <SheetOption
          label="Ver todas as tarefas"
          icon="check-square"
          onPress={() => {
            setOptions(false);
            onShowAll();
          }}
        />
      </Sheet>
    </View>
  );
}
