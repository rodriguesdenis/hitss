import { Text, View } from 'react-native';

import { errorCode, errorMessage, type ErrorCode } from '@/lib/error-messages';

import { Button } from './Button';
import type { StateAction } from './EmptyState';
import { Icon } from './Icon';

const NOT_FOUND: readonly ErrorCode[] = [
  'TASK_NOT_FOUND',
  'TEAM_NOT_FOUND',
  'ROUTE_NOT_FOUND',
];

function presentation(code: ErrorCode) {
  if (code === 'NETWORK') {
    return { icon: 'cloud-off', title: 'Você está offline' } as const;
  }
  if (NOT_FOUND.includes(code)) {
    return { icon: 'alert-circle', title: 'Não encontrado' } as const;
  }
  return { icon: 'alert-circle', title: 'Não foi possível carregar' } as const;
}

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  action?: StateAction;
}

export function ErrorState({ error, onRetry, action }: ErrorStateProps) {
  const { icon, title } = presentation(errorCode(error));
  const primary =
    action ?? (onRetry && { label: 'Tentar novamente', onPress: onRetry });
  return (
    <View className="error-state">
      <Icon name={icon} color="fg-subtle" size={48} />
      <Text className="type-headline text-center" accessibilityRole="alert">
        {title}
      </Text>
      <Text className="type-muted text-center">{errorMessage(error)}</Text>
      {primary && (
        <Button
          label={primary.label}
          onPress={primary.onPress}
          variant={primary.variant ?? 'primary'}
        />
      )}
    </View>
  );
}
