import { useRouter } from 'expo-router';

import { TeamsListScreen } from '@/features/teams';

export default function TeamsRoute() {
  const router = useRouter();
  return (
    <TeamsListScreen
      onOpenTeam={(team) =>
        router.push({ pathname: '/tasks', params: { teamId: team.id } })
      }
      onCreateTeam={() => router.push('/teams/new')}
      onEditTeam={(team) =>
        router.push({ pathname: '/teams/[id]/edit', params: { id: team.id } })
      }
    />
  );
}
