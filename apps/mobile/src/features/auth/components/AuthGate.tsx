import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useOwnedCache } from '@/offline';

import { useAuthSession } from '../session';

export function AuthGate() {
  const { status, user } = useAuthSession();
  const owned = useOwnedCache(
    status === 'signedIn' ? (user?.id ?? null) : null,
  );
  const ready = status !== 'loading' && owned;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="teams/new" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="teams/[id]/edit"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="tasks/[id]/index" />
        <Stack.Screen name="tasks/new" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="tasks/[id]/edit"
          options={{ presentation: 'modal' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
