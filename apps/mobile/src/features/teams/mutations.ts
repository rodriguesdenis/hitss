import {
  teamsCreate,
  teamsRemove,
  teamsReplace,
  type CreateTeamDto,
  type TeamResponseDto,
  type TeamsCreate201,
  type TeamsReplace200,
  type UpdateTeamDto,
} from '@hitss/api-client';
import { onlineManager, type QueryClient } from '@tanstack/react-query';

import { applyCacheEffects } from '@/lib/cache-effects';
import { mk, qk } from '@/lib/query-keys';
import {
  cancelRoot,
  defineDurableMutation,
  discardMessage,
  isAlreadyGone,
  resolveId,
  restoreEntity,
  snapshotEntity,
  useSyncStore,
  warnDiscarded,
  type EntitySnapshot,
} from '@/offline';
import { showToast } from '@/ui';

import {
  buildTempTeam,
  chipOf,
  confirmTeam,
  findTeam,
  insertTeam,
  mergeTeam,
  removeTeam,
  restoreChip,
  setChip,
} from './optimistic';

export type TeamCreateVars = { tempId: string; body: CreateTeamDto };
export type TeamUpdateVars = { id: string; body: UpdateTeamDto };
export type TeamDeleteVars = { id: string; name: string };

type Team = TeamResponseDto;

type Context = {
  queued: boolean;
  snapshot?: EntitySnapshot<Team>;
  previous?: Team;
  taskIds?: string[];
};

const isQueued = () => !onlineManager.isOnline();

const goneTeam = (name: string) => `“${name}” foi excluído em outro lugar.`;

export function registerTeamMutationDefaults(queryClient: QueryClient): void {
  defineDurableMutation<TeamCreateVars, TeamsCreate201, Context>(
    queryClient,
    mk.teams.create,
    {
      kind: 'create',
      mutationFn: ({ body }) => teamsCreate(body),
      onMutate: async ({ tempId, body }) => {
        await cancelRoot(queryClient, 'teams');
        insertTeam(queryClient, buildTempTeam(tempId, body));
        return { queued: isQueued() };
      },
      onSuccess: (response, { tempId }, context) => {
        const team = (response as TeamsCreate201).data;
        useSyncStore.getState().mapId(tempId, team.id);
        confirmTeam(queryClient, tempId, team);
        if (!context?.queued) {
          showToast({ message: 'Time criado' });
        }
      },
      onDiscard: (reason, error, { tempId, body }, context) => {
        removeTeam(queryClient, tempId);
        if (context?.queued) {
          warnDiscarded(
            discardMessage(reason, error, body.name, goneTeam(body.name)),
          );
        }
      },
      afterDrain: () =>
        applyCacheEffects(queryClient, 'teams.create', { id: '' }),
    },
  );

  defineDurableMutation<TeamUpdateVars, TeamsReplace200, Context>(
    queryClient,
    mk.teams.update,
    {
      kind: 'update',
      mutationFn: ({ id, body }) => teamsReplace(resolveId(id), body),
      onMutate: async ({ id, body }) => {
        await Promise.all([
          cancelRoot(queryClient, 'teams'),
          cancelRoot(queryClient, 'tasks'),
        ]);
        const snapshot = snapshotEntity<Team>(queryClient, 'teams', id);
        const previous = findTeam(queryClient, id);
        if (previous) {
          mergeTeam(queryClient, previous, body);
        }
        return { queued: isQueued(), snapshot, previous };
      },
      onSuccess: (response, { id }, context) => {
        queryClient.setQueryData(qk.teams.detail(resolveId(id)), response);
        if (!context?.queued) {
          showToast({ message: 'Time atualizado' });
        }
      },
      onDiscard: (reason, error, { id, body }, context) => {
        if (reason === 'gone') {
          removeTeam(queryClient, id);
        } else {
          if (context?.snapshot) {
            restoreEntity(queryClient, 'teams', context.snapshot);
          }
          if (context?.previous) {
            setChip(queryClient, id, chipOf(context.previous));
          }
        }
        if (context?.queued || reason === 'gone') {
          warnDiscarded(
            discardMessage(reason, error, body.name, goneTeam(body.name)),
          );
        }
      },
      afterDrain: ({ id }) =>
        applyCacheEffects(queryClient, 'teams.update', { id }),
    },
  );

  defineDurableMutation<TeamDeleteVars, void, Context>(
    queryClient,
    mk.teams.delete,
    {
      kind: 'delete',
      mutationFn: ({ id }) => teamsRemove(resolveId(id)),
      onMutate: async ({ id }) => {
        await Promise.all([
          cancelRoot(queryClient, 'teams'),
          cancelRoot(queryClient, 'tasks'),
        ]);
        const snapshot = snapshotEntity<Team>(queryClient, 'teams', id);
        const previous = findTeam(queryClient, id);
        const taskIds = removeTeam(queryClient, id);
        return { queued: isQueued(), snapshot, previous, taskIds };
      },
      onSuccess: (response, { id }, context) => {
        queryClient.removeQueries({
          predicate: (query) =>
            query.queryKey[0] === 'tasks' &&
            query.queryKey[1] === 'list' &&
            (query.queryKey[2] as { teamId?: string } | undefined)?.teamId ===
              resolveId(id),
        });
        if (!context?.queued && !isAlreadyGone(response)) {
          showToast({ message: 'Time excluído' });
        }
      },
      onDiscard: (reason, error, { name }, context) => {
        if (context?.snapshot) {
          restoreEntity(queryClient, 'teams', context.snapshot);
        }
        if (context?.previous) {
          restoreChip(
            queryClient,
            chipOf(context.previous),
            context.taskIds ?? [],
          );
        }
        warnDiscarded(discardMessage(reason, error, name, goneTeam(name)));
      },
      afterDrain: ({ id }) =>
        applyCacheEffects(queryClient, 'teams.delete', { id }),
    },
  );
}
