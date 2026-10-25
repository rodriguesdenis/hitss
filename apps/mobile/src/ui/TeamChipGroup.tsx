import type { TeamChipDto } from '@hitss/api-client';
import { Text, View } from 'react-native';

import { TeamChip } from './TeamChip';

export const LIST_CHIP_LIMIT = 3;

export function teamsAccessibilityLabel(
  teams: readonly Pick<TeamChipDto, 'name'>[],
): string {
  return `Times: ${teams.map((team) => team.name).join(', ')}`;
}

export interface TeamChipGroupProps {
  teams: readonly TeamChipDto[];
  variant?: 'list' | 'detail';
  onPressTeam?: (team: TeamChipDto) => void;
  teamHint?: string;
}

export function TeamChipGroup({
  teams,
  variant = 'list',
  onPressTeam,
  teamHint,
}: TeamChipGroupProps) {
  if (teams.length === 0) {
    return variant === 'detail' ? (
      <Text className="type-meta">Sem times</Text>
    ) : null;
  }
  const visible = variant === 'list' ? teams.slice(0, LIST_CHIP_LIMIT) : teams;
  const overflow = teams.length - visible.length;
  const interactive = variant === 'detail' && onPressTeam !== undefined;
  return (
    <View
      accessible={!interactive}
      accessibilityLabel={
        interactive ? undefined : teamsAccessibilityLabel(teams)
      }
      className="flex-row flex-wrap gap-1.5"
    >
      {visible.map((team) => (
        <TeamChip
          key={team.id}
          name={team.name}
          colorHex={team.colorHex}
          onPress={interactive ? () => onPressTeam(team) : undefined}
          accessibilityHint={teamHint}
        />
      ))}
      {overflow > 0 && (
        <View className="chip-overflow">
          <Text className="chip-overflow-label">{`+${overflow}`}</Text>
        </View>
      )}
    </View>
  );
}
