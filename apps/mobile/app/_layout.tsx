import '../src/theme/global.css';

import * as SplashScreen from 'expo-splash-screen';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  AuthGate,
  expireSession,
  getToken,
  sessionUserId,
} from '@/features/auth';
import { registerTaskMutationDefaults } from '@/features/tasks';
import { registerTeamMutationDefaults } from '@/features/teams';
import { setupApiClient } from '@/lib/api';
import { createQueryClient } from '@/lib/query-client';
import { onSessionReset } from '@/lib/session-reset';
import {
  createOfflineRuntime,
  OfflineQueryProvider,
  setDurableUnauthenticatedHandler,
  useSyncStoreReady,
} from '@/offline';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Toaster } from '@/ui';

LogBox.ignoreLogs(['ImageBackground is deprecated']);

void SplashScreen.preventAutoHideAsync();

setupApiClient(getToken);

const queryClient = createQueryClient({
  onUnauthenticated: () => void expireSession(queryClient),
});

registerTeamMutationDefaults(queryClient);
registerTaskMutationDefaults(queryClient);
setDurableUnauthenticatedHandler(() => void expireSession(queryClient));

const offline = createOfflineRuntime({
  queryClient,
  getSessionUserId: sessionUserId,
  onSessionLost: () => void expireSession(queryClient),
});

onSessionReset(offline.purge);

export default function RootLayout() {
  const ready = useSyncStoreReady();
  if (!ready) {
    return null;
  }
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OfflineQueryProvider runtime={offline}>
          <AuthGate />
          <Toaster />
        </OfflineQueryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
