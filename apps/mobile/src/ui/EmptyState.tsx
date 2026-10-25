import { Text, View } from 'react-native';

import { Button, type ButtonVariant } from './Button';
import { Icon, type IconName } from './Icon';

export interface StateAction {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
}

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  message?: string;
  action?: StateAction;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <View className="empty-state">
      <Icon name={icon} color="fg-subtle" size={48} />
      <Text className="type-headline text-center" accessibilityRole="header">
        {title}
      </Text>
      {message && <Text className="type-muted text-center">{message}</Text>}
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant={action.variant ?? 'primary'}
        />
      )}
    </View>
  );
}
