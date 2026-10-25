import Constants from 'expo-constants';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAuthSession, useSignOut } from '../session';

export function SettingsScreen() {
  const { user } = useAuthSession();
  const { signOut, signingOut } = useSignOut();
  const version = Constants.expoConfig?.version;

  return (
    <ScrollView className="screen" contentContainerClassName="px-4 pt-4 pb-8">
      <View className="section">
        <Text className="section-title" accessibilityRole="header">
          Conta
        </Text>
        <View
          className="card gap-1"
          accessible
          accessibilityLabel={user ? `${user.name}, ${user.email}` : undefined}
        >
          <Text className="type-headline">{user?.name}</Text>
          <Text className="type-muted">{user?.email}</Text>
        </View>
      </View>
      <Pressable
        className={
          signingOut ? 'btn-secondary btn-disabled mb-4' : 'btn-secondary mb-4'
        }
        accessibilityRole="button"
        accessibilityState={{ disabled: signingOut, busy: signingOut }}
        disabled={signingOut}
        onPress={() => void signOut()}
      >
        <Text className="btn-ghost-danger-label">Sair</Text>
      </Pressable>
      {version ? (
        <Text className="type-meta">{`Versão ${version}`}</Text>
      ) : null}
    </ScrollView>
  );
}
