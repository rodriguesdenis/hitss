import '../src/theme/global.css';

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getToken } from '@/features/auth';
import { setupApiClient } from '@/lib/api';
import { ThemeProvider } from '@/theme/ThemeProvider';

setupApiClient(getToken);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
