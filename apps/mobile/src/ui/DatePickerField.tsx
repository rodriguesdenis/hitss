import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { formatLongDate, parseCalendarDate, toCalendarDate } from '@/lib/dates';

import { cx } from './cx';
import { useField } from './Field';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Sheet } from './Sheet';

export interface DatePickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  clearLabel?: string;
  disabled?: boolean;
  testID?: string;
}

export function DatePickerField({
  value,
  onChange,
  placeholder = 'Selecione uma data',
  clearLabel = 'Remover prazo',
  disabled = false,
  testID,
}: DatePickerFieldProps) {
  const field = useField();
  const [open, setOpen] = useState(false);
  const shown = value ? formatLongDate(value) : placeholder;

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    setOpen(false);
    if (event.type === 'set' && date) {
      onChange(toCalendarDate(date));
    }
  }

  const picker = open && (
    <DateTimePicker
      testID={testID && `${testID}-picker`}
      value={value ? parseCalendarDate(value) : new Date()}
      mode="date"
      display={Platform.OS === 'ios' ? 'inline' : 'default'}
      locale="pt-BR"
      onChange={handleChange}
    />
  );

  return (
    <View className="flex-row items-center">
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={[field?.accessibilityLabel, shown]
          .filter(Boolean)
          .join(', ')}
        accessibilityState={{ disabled }}
        className={cx(
          'input flex-1 flex-row items-center gap-2 pr-12',
          field?.invalid && 'input-error',
          disabled && 'opacity-50',
        )}
      >
        <Icon name="calendar" color="fg-muted" />
        <Text className={value ? 'type-body' : 'text-body text-fg-subtle'}>
          {shown}
        </Text>
      </Pressable>
      {value && !disabled && (
        <View className="absolute right-0.5">
          <IconButton
            icon="close"
            label={clearLabel}
            color="fg-muted"
            onPress={() => onChange(null)}
          />
        </View>
      )}
      {Platform.OS === 'ios' ? (
        <Sheet visible={open} onClose={() => setOpen(false)}>
          {picker}
        </Sheet>
      ) : (
        picker
      )}
    </View>
  );
}
