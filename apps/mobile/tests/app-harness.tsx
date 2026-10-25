import { useTeamsList } from '@hitss/api-client';
import type { QueryClient } from '@tanstack/react-query';
import { Stack, Tabs } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { JSX } from 'react';
import { Pressable, Text } from 'react-native';

import {
  AuthGate,
  AuthRedirect,
  expireSession,
  getToken,
  setToken,
  useSessionStore,
  useSignOut,
} from '@/features/auth';
import { setupApiClient } from '@/lib/api';
import { createMemoryStorage } from '@/lib/storage';
import { onSessionReset } from '@/lib/session-reset';
import {
  createOfflineRuntime,
  OfflineQueryProvider,
  type OfflineRuntime,
} from '@/offline';

import { createTestQueryClient } from './renderWithProviders';

export { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
export { getToken };

let client: QueryClient;
let runtime: OfflineRuntime;

export const queryClient = () => client;
export const offlineRuntime = () => runtime;

function SignIn() {
  const expired = useSessionStore((s) => s.expired);
  return (
    <>
      <Text>sign-in screen</Text>
      {expired ? <Text>Sua sessão expirou. Entre novamente.</Text> : null}
    </>
  );
}

function SignOutButton() {
  const { signOut } = useSignOut();
  return (
    <Pressable accessibilityRole="button" onPress={() => void signOut()}>
      <Text>Sair</Text>
    </Pressable>
  );
}

function TeamsProbe() {
  useTeamsList();
  return null;
}

export async function renderApp({
  token,
  initialUrl,
  fetchTeams = false,
  routes = {},
  storage = createMemoryStorage(),
}: {
  token?: string;
  initialUrl: string;
  fetchTeams?: boolean;
  routes?: Record<string, () => JSX.Element | null>;
  storage?: ReturnType<typeof createMemoryStorage>;
}) {
  if (token) {
    await setToken(token);
  }
  setupApiClient(getToken);
  client = createTestQueryClient({
    onUnauthenticated: () => void expireSession(client),
  });
  runtime = createOfflineRuntime({
    queryClient: client,
    storage,
    buster: 'test',
  });
  onSessionReset(runtime.purge);
  return renderRouter(
    {
      _layout: () => (
        <OfflineQueryProvider runtime={runtime}>
          <AuthGate />
        </OfflineQueryProvider>
      ),
      index: AuthRedirect,
      '(auth)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      '(auth)/sign-in': SignIn,
      '(tabs)/_layout': () => (
        <Tabs>
          <Tabs.Screen name="tasks" />
          <Tabs.Screen name="settings" />
        </Tabs>
      ),
      '(tabs)/tasks': () => (
        <>
          <Text>tasks screen</Text>
          {fetchTeams ? <TeamsProbe /> : null}
          <SignOutButton />
        </>
      ),
      ...routes,
    },
    { initialUrl },
  );
}
