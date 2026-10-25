import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { TaskFormScreen } from '@/features/tasks';

export default function NewTaskRoute() {
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();
  const [dirty, setDirty] = useState(false);
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !dirty }} />
      <TaskFormScreen
        teamId={teamId || undefined}
        onClose={() => router.back()}
        onCreateTeam={() => router.push('/teams/new')}
        onDirtyChange={setDirty}
      />
    </>
  );
}
