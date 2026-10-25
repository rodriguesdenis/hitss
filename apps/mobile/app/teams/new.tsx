import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { offerCreatedTeam, TeamFormScreen } from '@/features/teams';

export default function NewTeamRoute() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [dirty, setDirty] = useState(false);
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !dirty }} />
      <TeamFormScreen
        onClose={() => router.back()}
        onCreated={
          from === 'task' ? (team) => offerCreatedTeam(team.id) : undefined
        }
        onDirtyChange={setDirty}
      />
    </>
  );
}
