import { useState, type ComponentRef, type Ref } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useColorSchemeName } from '@/theme/ThemeProvider';
import { tokens } from '@/theme/tokens';

import { cx } from './cx';
import { useField } from './Field';

export interface InputProps extends Omit<TextInputProps, 'className'> {
  className?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function Input({
  className,
  multiline,
  editable = true,
  onFocus,
  onBlur,
  accessibilityLabel,
  ref,
  ...props
}: InputProps) {
  const field = useField();
  const scheme = useColorSchemeName();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      {...props}
      multiline={multiline}
      editable={editable}
      accessibilityLabel={accessibilityLabel ?? field?.accessibilityLabel}
      accessibilityState={{ disabled: !editable }}
      placeholderTextColor={tokens[scheme]['fg-subtle']}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      className={cx(
        multiline ? 'input-multiline' : 'input',
        field?.invalid ? 'input-error' : focused && 'input-focused',
        !editable && 'opacity-50',
        className,
      )}
    />
  );
}
