import type { TaskResponseDto } from '@hitss/api-client';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { useTeam } from '@/features/teams';
import { errorCode } from '@/lib/error-messages';
import { useColorSchemeName } from '@/theme/ThemeProvider';
import { tokens } from '@/theme/tokens';
import {
  Button,
  EmptyState,
  ErrorState,
  Fab,
  Screen,
  showToast,
  SkeletonList,
} from '@/ui';

import {
  GLOBAL_SCOPE,
  hasActiveFilters,
  useTaskFilters,
  useTaskFiltersStore,
} from '../filters.store';
import { tasksTotalLabel } from '../format';
import { useTasksInfiniteList } from '../hooks/useTasksList';
import { StatusSheet } from './StatusSheet';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskRow } from './TaskRow';
import { TeamTasksHeader } from './TeamTasksHeader';

export interface TasksListScreenProps {
  teamId?: string;
  onOpenTask: (task: TaskResponseDto) => void;
  onCreateTask: (teamId?: string) => void;
  onShowAll: () => void;
  onBackToTeams: () => void;
  onEditTeam: (teamId: string) => void;
}

export function TasksListScreen({
  teamId,
  onOpenTask,
  onCreateTask,
  onShowAll,
  onBackToTeams,
  onEditTeam,
}: TasksListScreenProps) {
  const scheme = useColorSchemeName();
  const scope = teamId ?? GLOBAL_SCOPE;
  const filters = useTaskFilters(scope);
  const clearFilters = useTaskFiltersStore((state) => state.clear);
  const team = useTeam(teamId);
  const list = useTasksInfiniteList(teamId, filters);
  const [statusFor, setStatusFor] = useState<TaskResponseDto>();
  const [refreshing, setRefreshing] = useState(false);

  if (teamId && team.isError && errorCode(team.error) === 'TEAM_NOT_FOUND') {
    return (
      <Screen>
        <ErrorState
          error={team.error}
          action={{ label: 'Voltar para times', onPress: onBackToTeams }}
        />
      </Screen>
    );
  }

  async function refresh() {
    setRefreshing(true);
    const result = await list.refetch();
    setRefreshing(false);
    if (result.isError) {
      showToast({
        message: 'Não foi possível atualizar. Exibindo dados salvos.',
        tone: 'error',
      });
    }
  }

  function footer() {
    if (list.isFetchingNextPage) {
      return (
        <View className="flex-row items-center justify-center gap-2 py-4">
          <ActivityIndicator color={tokens[scheme].primary} />
          <Text className="type-meta">Carregando mais…</Text>
        </View>
      );
    }
    if (list.isFetchNextPageError) {
      return (
        <View className="items-center gap-2 py-4">
          <Text className="type-meta">Não foi possível carregar mais.</Text>
          <Button
            label="Tentar novamente"
            variant="ghost"
            onPress={() => list.fetchNextPage()}
          />
        </View>
      );
    }
    if (!list.hasNextPage) {
      return (
        <Text className="type-meta py-4 text-center">
          {tasksTotalLabel(list.total)}
        </Text>
      );
    }
    return undefined;
  }

  function body() {
    if (list.isPending) {
      return (
        <View className="px-4">
          <SkeletonList label="Carregando tarefas" />
        </View>
      );
    }
    if (list.isError && list.tasks.length === 0) {
      return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
    }
    if (list.tasks.length === 0) {
      if (hasActiveFilters(filters)) {
        return (
          <EmptyState
            icon="search"
            title="Nenhuma tarefa corresponde aos filtros"
            message="Tente outro status ou termo de busca."
            action={{
              label: 'Limpar filtros',
              variant: 'secondary',
              onPress: () => clearFilters(scope),
            }}
          />
        );
      }
      return (
        <EmptyState
          icon="check-square"
          title={
            team.data
              ? `Nenhuma tarefa em ${team.data.name} ainda`
              : 'Nenhuma tarefa ainda'
          }
          message="Registre sua primeira tarefa — leva segundos."
          action={{ label: 'Nova tarefa', onPress: () => onCreateTask(teamId) }}
        />
      );
    }
    return (
      <FlatList
        testID="tasks-list"
        data={list.tasks}
        keyExtractor={(task) => task.id}
        contentContainerClassName="gap-2 px-4 pb-24"
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onPress={() => onOpenTask(item)}
            onLongPress={() => setStatusFor(item)}
          />
        )}
        onEndReachedThreshold={1.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) {
            void list.fetchNextPage();
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={tokens[scheme].primary}
            colors={[tokens[scheme].primary]}
          />
        }
        ListFooterComponent={footer()}
      />
    );
  }

  return (
    <Screen>
      <View className="gap-3 px-4 pb-3 pt-4">
        {teamId ? (
          team.data && (
            <TeamTasksHeader
              team={team.data}
              onBack={onBackToTeams}
              onEditTeam={() => onEditTeam(teamId)}
              onShowAll={onShowAll}
            />
          )
        ) : (
          <Text className="type-title" accessibilityRole="header">
            Tarefas
          </Text>
        )}
        <TaskFilterBar scope={scope} teamName={team.data?.name} />
      </View>
      {body()}
      <Fab label="Nova tarefa" onPress={() => onCreateTask(teamId)} />
      <StatusSheet task={statusFor} onClose={() => setStatusFor(undefined)} />
    </Screen>
  );
}
