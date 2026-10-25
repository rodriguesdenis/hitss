import '../src/theme/global.css';

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getToken } from '@/features/auth';
import { setupApiClient } from '@/lib/api';
import { createQueryClient } from '@/lib/query-client';
import { QueryProvider } from '@/lib/QueryProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

setupApiClient(getToken);

const queryClient = createQueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
        </QueryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
