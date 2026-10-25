import { useLocalSearchParams, useRouter } from 'expo-router';

import { TasksListScreen } from '@/features/tasks';

export default function TasksRoute() {
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();
  return (
    <TasksListScreen
      key={teamId ?? 'all'}
      teamId={teamId || undefined}
      onOpenTask={(task) =>
        router.push({ pathname: '/tasks/[id]', params: { id: task.id } })
      }
      onCreateTask={(team) =>
        router.push(
          team
            ? { pathname: '/tasks/new', params: { teamId: team } }
            : '/tasks/new',
        )
      }
      onShowAll={() => router.replace('/tasks')}
      onBackToTeams={() => router.navigate('/teams')}
      onEditTeam={(id) =>
        router.push({ pathname: '/teams/[id]/edit', params: { id } })
      }
    />
  );
}
