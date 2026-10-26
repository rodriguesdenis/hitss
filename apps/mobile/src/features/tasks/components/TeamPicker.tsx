import { Text, View } from 'react-native';

import { Button, Field, Skeleton, TeamChip } from '@/ui';

import { useTeamOptions } from '../hooks/useTeamOptions';
import { TEAMS_LIMIT, TEAMS_MAX } from '../task-form.schema';

export interface TeamPickerProps {
  value: string[];
  onChange: (teamIds: string[]) => void;
  error?: string;
  disabled?: boolean;
  onCreateTeam?: () => void;
}

export function TeamPicker({
  value,
  onChange,
  error,
  disabled = false,
  onCreateTeam,
}: TeamPickerProps) {
  const options = useTeamOptions();
  const full = value.length >= TEAMS_MAX;

  function toggle(id: string) {
    onChange(
      value.includes(id)
        ? value.filter((selected) => selected !== id)
        : [...value, id],
    );
  }

  function content() {
    if (options.isPending) {
      return (
        <View
          accessible
          accessibilityLabel="Carregando times"
          accessibilityState={{ busy: true }}
          className="flex-row gap-2"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} shape="chip" width={72} />
          ))}
        </View>
      );
    }
    if (options.isError) {
      return (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="type-meta">Não foi possível carregar os times.</Text>
          <Button
            label="Tentar novamente"
            variant="ghost"
            onPress={() => options.refetch()}
          />
        </View>
      );
    }
    if (options.teams.length === 0) {
      return <Text className="type-meta">Nenhum time ainda</Text>;
    }
    return (
      <View className="flex-row flex-wrap gap-2">
        {options.teams.map((team) => {
          const selected = value.includes(team.id);
          return (
            <TeamChip
              key={team.id}
              name={team.name}
              colorHex={team.colorHex}
              selected={selected}
              disabled={disabled || (full && !selected)}
              onPress={() => toggle(team.id)}
            />
          );
        })}
      </View>
    );
  }

  return (
    <Field
      label="Times"
      error={error}
      help={full ? TEAMS_LIMIT : `${value.length} de ${TEAMS_MAX} times`}
    >
      {content()}
      {onCreateTeam && (
        <Button
          label="Novo time"
          icon="plus"
          variant="ghost"
          className="self-start"
          onPress={onCreateTeam}
        />
      )}
    </Field>
  );
}
