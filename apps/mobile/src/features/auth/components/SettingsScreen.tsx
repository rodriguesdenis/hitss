import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { pendingLabel, usePendingSync } from '@/offline';
import { Button, ConfirmDialog, Icon, Screen } from '@/ui';

import { useAuthSession, useSignOut } from '../session';

export function SettingsScreen() {
  const { user } = useAuthSession();
  const { signOut, signingOut } = useSignOut();
  const version = Constants.expoConfig?.version;
  const { count } = usePendingSync();
  const [confirming, setConfirming] = useState(false);

  const requestSignOut = () => {
    if (count > 0) {
      setConfirming(true);
    } else {
      void signOut();
    }
  };

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
        <View className="section">
          <Text className="section-title" accessibilityRole="header">
            Sincronização
          </Text>
          <View className="card flex-row items-center gap-2" accessible>
            <Icon
              name={count > 0 ? 'clock' : 'check-circle'}
              color={count > 0 ? 'on-info-soft' : 'success'}
            />
            <Text className="type-body flex-1">{pendingLabel(count)}</Text>
          </View>
        </View>
        <Button
          variant="ghost-danger"
          className="mb-4 border border-border-strong"
          icon="logout"
          label="Sair"
          testID="sign-out"
          loading={signingOut}
          onPress={requestSignOut}
        />
        {version ? (
          <Text className="type-meta">{`Versão ${version}`}</Text>
        ) : null}
      </ScrollView>
      <ConfirmDialog
        visible={confirming}
        title="Sair com alterações não sincronizadas?"
        message={`Você tem ${count} ${count === 1 ? 'alteração não sincronizada' : 'alterações não sincronizadas'}. Ao sair, ${count === 1 ? 'ela será descartada' : 'elas serão descartadas'}.`}
        confirmLabel="Sair mesmo assim"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void signOut();
        }}
      />
    </Screen>
  );
}
