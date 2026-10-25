import '../src/theme/global.css';

import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate, expireSession, getToken } from '@/features/auth';
import { setupApiClient } from '@/lib/api';
import { createQueryClient } from '@/lib/query-client';
import { QueryProvider } from '@/lib/QueryProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Toaster } from '@/ui';

void SplashScreen.preventAutoHideAsync();

setupApiClient(getToken);

const queryClient = createQueryClient({
  onUnauthenticated: () => void expireSession(queryClient),
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryProvider client={queryClient}>
          <AuthGate />
          <Toaster />
        </QueryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
