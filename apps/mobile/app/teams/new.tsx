import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { TeamFormScreen } from '@/features/teams';

export default function NewTeamRoute() {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  return (
    <>
      <Stack.Screen
        options={{ presentation: 'modal', gestureEnabled: !dirty }}
      />
      <TeamFormScreen onClose={() => router.back()} onDirtyChange={setDirty} />
    </>
  );
}
