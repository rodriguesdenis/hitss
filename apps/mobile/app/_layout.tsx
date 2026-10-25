import '../src/theme/global.css';

import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate, expireSession, getToken } from '@/features/auth';
import { setupApiClient } from '@/lib/api';
import { createQueryClient } from '@/lib/query-client';
import { onSessionReset } from '@/lib/session-reset';
import {
  createOfflineRuntime,
  OfflineQueryProvider,
  useSyncStoreReady,
} from '@/offline';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Toaster } from '@/ui';

void SplashScreen.preventAutoHideAsync();

setupApiClient(getToken);

const queryClient = createQueryClient({
  onUnauthenticated: () => void expireSession(queryClient),
});

const offline = createOfflineRuntime({ queryClient });

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
