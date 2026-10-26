import { Tabs, useLocalSearchParams, useRouter } from 'expo-router';

import { TasksListScreen } from '@/features/tasks';
import { useTeam } from '@/features/teams';
import { IconButton } from '@/ui';

export default function TasksRoute() {
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();
  const team = useTeam(teamId || undefined);
  const showAll = () => router.replace('/tasks');
  return (
    <>
      <Tabs.Screen
        options={{
          headerTitle: teamId ? (team.data?.name ?? 'Tarefas') : undefined,
          headerLeft: teamId
            ? () => (
                <IconButton
                  icon="chevron-left"
                  label="Voltar para todas as tarefas"
                  onPress={showAll}
                />
              )
            : undefined,
        }}
      />
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
        onShowAll={showAll}
        onBackToTeams={() => router.navigate('/teams')}
        onEditTeam={(id) =>
          router.push({ pathname: '/teams/[id]/edit', params: { id } })
        }
      />
    </>
  );
}
