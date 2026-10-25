import { View } from 'react-native';

import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Input } from './Input';

export const SEARCH_MAX_LENGTH = 100;

export interface SearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  testID?: string;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder,
  testID,
}: SearchInputProps) {
  return (
    <View className="flex-row items-center">
      <View className="absolute left-3 z-10" pointerEvents="none">
        <Icon name="search" color="fg-subtle" />
      </View>
      <Input
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        maxLength={SEARCH_MAX_LENGTH}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        className="search-input pr-12"
      />
      {value.length > 0 && (
        <View className="absolute right-0.5">
          <IconButton
            icon="close"
            label="Limpar busca"
            color="fg-muted"
            onPress={() => onChangeText('')}
          />
        </View>
      )}
    </View>
  );
}
