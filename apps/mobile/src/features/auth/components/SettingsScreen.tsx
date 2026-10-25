import Constants from 'expo-constants';
import { ScrollView, Text, View } from 'react-native';

import { Button, Screen } from '@/ui';

import { useAuthSession, useSignOut } from '../session';

export function SettingsScreen() {
  const { user } = useAuthSession();
  const { signOut, signingOut } = useSignOut();
  const version = Constants.expoConfig?.version;

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerClassName="px-4 pt-4 pb-8">
        <View className="section">
          <Text className="section-title" accessibilityRole="header">
            Conta
          </Text>
          <View
            className="card gap-1"
            accessible
            accessibilityLabel={
              user ? `${user.name}, ${user.email}` : undefined
            }
          >
            <Text className="type-headline">{user?.name}</Text>
            <Text className="type-muted">{user?.email}</Text>
          </View>
        </View>
        <Button
          variant="ghost-danger"
          className="mb-4 border border-border-strong"
          icon="logout"
          label="Sair"
          loading={signingOut}
          onPress={() => void signOut()}
        />
        {version ? (
          <Text className="type-meta">{`Versão ${version}`}</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
