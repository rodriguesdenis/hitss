import type { TeamResponseDto } from '@hitss/api-client';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { useColorSchemeName } from '@/theme/ThemeProvider';
import { tokens } from '@/theme/tokens';
import {
  Button,
  EmptyState,
  ErrorState,
  Fab,
  Screen,
  SearchInput,
  showToast,
  SkeletonList,
} from '@/ui';

import { useTeamsInfiniteList } from '../hooks/useTeamsList';
import { DeleteTeamDialog } from './DeleteTeamDialog';
import { TeamCard } from './TeamCard';
import { TeamOptionsSheet } from './TeamOptionsSheet';

export interface TeamsListScreenProps {
  onOpenTeam: (team: TeamResponseDto) => void;
  onCreateTeam: () => void;
  onEditTeam: (team: TeamResponseDto) => void;
}

export function TeamsListScreen({
  onOpenTeam,
  onCreateTeam,
  onEditTeam,
}: TeamsListScreenProps) {
  const scheme = useColorSchemeName();
  const [search, setSearch] = useState('');
  const [optionsFor, setOptionsFor] = useState<TeamResponseDto>();
  const [deleting, setDeleting] = useState<TeamResponseDto>();
  const [refreshing, setRefreshing] = useState(false);
  const list = useTeamsInfiniteList(search);

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

  function body() {
    if (list.isPending) {
      return (
        <View className="px-4">
          <SkeletonList label="Carregando times" variant="team" />
        </View>
      );
    }
    if (list.isError && list.teams.length === 0) {
      return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
    }
    if (list.teams.length === 0) {
      return list.params.search ? (
        <EmptyState
          icon="search"
          title={`Nenhum time corresponde a “${list.params.search}”`}
          action={{
            label: 'Limpar busca',
            variant: 'secondary',
            onPress: () => setSearch(''),
          }}
        />
      ) : (
        <EmptyState
          icon="users"
          title="Nenhum time ainda"
          message="Times agrupam tarefas relacionadas e dão uma cor a elas."
          action={{ label: 'Criar time', onPress: onCreateTeam }}
        />
      );
    }
    return (
      <FlatList
        testID="teams-list"
        data={list.teams}
        keyExtractor={(team) => team.id}
        contentContainerClassName="gap-2 px-4 pb-24"
        renderItem={({ item }) => (
          <TeamCard
            team={item}
            onPress={() => onOpenTeam(item)}
            onOptions={() => setOptionsFor(item)}
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
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <View className="flex-row items-center justify-center gap-2 py-4">
              <ActivityIndicator color={tokens[scheme].primary} />
              <Text className="type-meta">Carregando mais…</Text>
            </View>
          ) : list.isFetchNextPageError ? (
            <View className="items-center gap-2 py-4">
              <Text className="type-meta">Não foi possível carregar mais.</Text>
              <Button
                label="Tentar novamente"
                variant="ghost"
                onPress={() => list.fetchNextPage()}
              />
            </View>
          ) : undefined
        }
      />
    );
  }

  return (
    <Screen>
      <View className="gap-3 px-4 pb-3 pt-4">
        <Text className="type-title" accessibilityRole="header">
          Times
        </Text>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar times"
        />
      </View>
      {body()}
      <Fab label="Novo time" onPress={onCreateTeam} />
      <TeamOptionsSheet
        team={optionsFor}
        onClose={() => setOptionsFor(undefined)}
        onEdit={onEditTeam}
        onDelete={setDeleting}
      />
      <DeleteTeamDialog
        team={deleting}
        onCancel={() => setDeleting(undefined)}
      />
    </Screen>
  );
}
