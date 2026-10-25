import { Input, type InputProps } from './Input';

export type TextAreaProps = Omit<InputProps, 'multiline'>;

export function TextArea(props: TextAreaProps) {
  return <Input {...props} multiline textAlignVertical="top" />;
}
