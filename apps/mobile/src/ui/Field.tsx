import { createContext, useContext, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Icon } from './Icon';

export interface FieldContextValue {
  accessibilityLabel: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

export interface FieldProps {
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  count?: number;
  max?: number;
  children: ReactNode;
}

export function fieldAccessibilityLabel({
  label,
  required,
  error,
}: Pick<FieldProps, 'label' | 'required' | 'error'>): string {
  return [label, required && 'obrigatório', error].filter(Boolean).join(', ');
}

export function Field({
  label,
  required = false,
  help,
  error,
  count,
  max,
  children,
}: FieldProps) {
  const context = {
    accessibilityLabel: fieldAccessibilityLabel({ label, required, error }),
    invalid: Boolean(error),
  };
  const hidden = {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  } as const;
  return (
    <FieldContext.Provider value={context}>
      <View className="field">
        <Text className="field-label" {...hidden}>
          {required ? `${label} *` : label}
        </Text>
        {children}
        {error ? (
          <View className="flex-row items-center gap-1" {...hidden}>
            <Icon name="alert-circle" color="danger" size={14} />
            <Text className="field-error">{error}</Text>
          </View>
        ) : (
          help && (
            <Text className="field-help" {...hidden}>
              {help}
            </Text>
          )
        )}
        {max !== undefined && (
          <Text
            className={
              (count ?? 0) >= max
                ? 'field-error self-end'
                : 'field-help self-end'
            }
            accessibilityLabel={`${count ?? 0} de ${max} caracteres`}
          >
            {`${count ?? 0} / ${max}`}
          </Text>
        )}
      </View>
    </FieldContext.Provider>
  );
}
