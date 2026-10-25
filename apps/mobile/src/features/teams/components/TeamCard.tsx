import type { TeamResponseDto } from '@hitss/api-client';
import { Pressable, Text, View } from 'react-native';

import { Icon, IconButton } from '@/ui';

import { taskCountLabel } from '../format';

export interface TeamCardProps {
  team: TeamResponseDto;
  onPress: () => void;
  onOptions: () => void;
}

export function TeamCard({ team, onPress, onOptions }: TeamCardProps) {
  const count = taskCountLabel(team.taskCount);
  return (
    <View className="list-item flex-row items-center gap-3 pl-0 py-0">
      <View
        className="w-1 self-stretch rounded-full"
        style={{ backgroundColor: team.colorHex }}
      />
      <Pressable
        testID={`team-${team.id}`}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={[team.name, team.description, count]
          .filter(Boolean)
          .join('. ')}
        accessibilityHint="Mostra as tarefas deste time"
        className="flex-1 min-h-row-min justify-center gap-1 py-3"
      >
        <View className="flex-row items-center gap-2">
          <View
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: team.colorHex }}
          />
          <Text className="type-headline flex-1" numberOfLines={2}>
            {team.name}
          </Text>
          <Icon name="chevron-right" color="fg-subtle" />
        </View>
        {team.description && (
          <Text className="type-muted" numberOfLines={1}>
            {team.description}
          </Text>
        )}
        <Text className="type-meta">{count}</Text>
      </Pressable>
      <IconButton
        icon="more"
        label={`Opções do time ${team.name}`}
        color="fg-muted"
        onPress={onOptions}
      />
    </View>
  );
}
