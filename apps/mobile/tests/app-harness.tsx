import { useTeamsList } from '@hitss/api-client';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { Stack, Tabs } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import {
  AuthGate,
  AuthRedirect,
  expireSession,
  getToken,
  setToken,
  useSessionNotice,
} from '@/features/auth';
import { setupApiClient } from '@/lib/api';

import { createTestQueryClient } from './renderWithProviders';

export { act, screen } from 'expo-router/testing-library';
export { getToken };

let client: QueryClient;

export const queryClient = () => client;

function SignIn() {
  const expired = useSessionNotice((s) => s.expired);
  return (
    <>
      <Text>sign-in screen</Text>
      {expired ? <Text>Sua sessão expirou. Entre novamente.</Text> : null}
    </>
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
}: {
  token?: string;
  initialUrl: string;
  fetchTeams?: boolean;
}) {
  if (token) {
    await setToken(token);
  }
  setupApiClient(getToken);
  client = createTestQueryClient({
    onUnauthenticated: () => void expireSession(client),
  });
  return renderRouter(
    {
      _layout: () => (
        <QueryClientProvider client={client}>
          <AuthGate />
        </QueryClientProvider>
      ),
      index: AuthRedirect,
      '(auth)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      '(auth)/sign-in': SignIn,
      '(tabs)/_layout': () => (
        <Tabs>
          <Tabs.Screen name="tasks" />
        </Tabs>
      ),
      '(tabs)/tasks': () => (
        <>
          <Text>tasks screen</Text>
          {fetchTeams ? <TeamsProbe /> : null}
        </>
      ),
    },
    { initialUrl },
  );
}
