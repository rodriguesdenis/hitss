import { Text, View } from 'react-native';

import { TeamChip } from '@/ui';

export interface ChipPreviewProps {
  name: string;
  colorHex: string;
}

export function ChipPreview({ name, colorHex }: ChipPreviewProps) {
  const label = name.trim() || 'Nome do time';
  return (
    <View
      accessible
      accessibilityLabel={`Prévia, ${label}`}
      className="field flex-row items-center gap-3"
    >
      <Text className="field-label">Prévia</Text>
      <TeamChip testID="chip-preview" name={label} colorHex={colorHex} />
    </View>
  );
}
