import { Text, View } from 'react-native';

import { Button } from './Button';

export interface ModalHeaderProps {
  title: string;
  onCancel: () => void;
  cancelLabel?: string;
}

export function ModalHeader({
  title,
  onCancel,
  cancelLabel = 'Cancelar',
}: ModalHeaderProps) {
  return (
    <View className="flex-row items-center gap-2 border-b border-border-muted px-2 pb-2">
      <Button label={cancelLabel} variant="ghost" onPress={onCancel} />
      <Text
        className="type-headline flex-1 text-center"
        accessibilityRole="header"
      >
        {title}
      </Text>
      <View className="w-touch" />
    </View>
  );
}
