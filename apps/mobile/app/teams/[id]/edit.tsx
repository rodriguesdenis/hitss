import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { TeamFormScreen } from '@/features/teams';

export default function EditTeamRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dirty, setDirty] = useState(false);
  return (
    <>
      <Stack.Screen
        options={{ presentation: 'modal', gestureEnabled: !dirty }}
      />
      <TeamFormScreen
        teamId={id}
        onClose={() => router.back()}
        onDeleted={() => router.dismissTo('/teams')}
        onDirtyChange={setDirty}
      />
    </>
  );
}
