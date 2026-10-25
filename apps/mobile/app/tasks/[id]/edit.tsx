import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { TaskFormScreen } from '@/features/tasks';

export default function EditTaskRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dirty, setDirty] = useState(false);
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !dirty }} />
      <TaskFormScreen
        taskId={id}
        onClose={() => router.back()}
        onCreateTeam={() =>
          router.push({ pathname: '/teams/new', params: { from: 'task' } })
        }
        onDirtyChange={setDirty}
      />
    </>
  );
}
