import { useLocalSearchParams, useRouter } from 'expo-router';

import { TaskDetailScreen } from '@/features/tasks';

export default function TaskDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <TaskDetailScreen
      taskId={id}
      onBack={() => router.back()}
      onEdit={(task) =>
        router.push({ pathname: '/tasks/[id]/edit', params: { id: task.id } })
      }
      onOpenTeam={(team) =>
        router.push({ pathname: '/tasks', params: { teamId: team.id } })
      }
      onDeleted={() => router.back()}
    />
  );
}
