import {
  teamsCreate,
  teamsRemove,
  teamsReplace,
  type CreateTeamDto,
  type TeamsCreate201,
  type TeamsReplace200,
  type UpdateTeamDto,
} from '@hitss/api-client';
import { onlineManager, type QueryClient } from '@tanstack/react-query';

import { applyCacheEffects } from '@/lib/cache-effects';
import { mk } from '@/lib/query-keys';
import {
  defineDurableMutation,
  discardMessage,
  isAlreadyGone,
  resolveId,
  useSyncStore,
  warnDiscarded,
} from '@/offline';
import { showToast } from '@/ui';

export type TeamCreateVars = { tempId: string; body: CreateTeamDto };
export type TeamUpdateVars = { id: string; body: UpdateTeamDto };
export type TeamDeleteVars = { id: string; name: string };

type Queued = { queued: boolean };

const queued = (): Queued => ({ queued: !onlineManager.isOnline() });

const goneTeam = (name: string) => `“${name}” foi excluído em outro lugar.`;

export function registerTeamMutationDefaults(queryClient: QueryClient): void {
  defineDurableMutation<TeamCreateVars, TeamsCreate201, Queued>(
    queryClient,
    mk.teams.create,
    {
      kind: 'create',
      mutationFn: ({ body }) => teamsCreate(body),
      onMutate: queued,
      onSuccess: async (response, { tempId }, context) => {
        if (isAlreadyGone(response)) {
          return;
        }
        const team = (response as TeamsCreate201).data;
        useSyncStore.getState().mapId(tempId, team.id);
        if (!context?.queued) {
          showToast({ message: 'Time criado' });
        }
      },
      onDiscard: (reason, error, { body }) =>
        warnDiscarded(
          discardMessage(reason, error, body.name, goneTeam(body.name)),
        ),
      afterDrain: () =>
        applyCacheEffects(queryClient, 'teams.create', { id: '' }),
    },
  );

  defineDurableMutation<TeamUpdateVars, TeamsReplace200, Queued>(
    queryClient,
    mk.teams.update,
    {
      kind: 'update',
      mutationFn: ({ id, body }) => teamsReplace(resolveId(id), body),
      onMutate: queued,
      onSuccess: (_response, _vars, context) => {
        if (!context?.queued) {
          showToast({ message: 'Time atualizado' });
        }
      },
      onDiscard: (reason, error, { body }) =>
        warnDiscarded(
          discardMessage(reason, error, body.name, goneTeam(body.name)),
        ),
      afterDrain: ({ id }) =>
        applyCacheEffects(queryClient, 'teams.update', { id }),
    },
  );

  defineDurableMutation<TeamDeleteVars, void, Queued>(
    queryClient,
    mk.teams.delete,
    {
      kind: 'delete',
      mutationFn: ({ id }) => teamsRemove(resolveId(id)),
      onMutate: queued,
      onSuccess: (response, _vars, context) => {
        if (!context?.queued && !isAlreadyGone(response)) {
          showToast({ message: 'Time excluído' });
        }
      },
      onDiscard: (reason, error, { name }) =>
        warnDiscarded(discardMessage(reason, error, name, goneTeam(name))),
      afterDrain: ({ id }) =>
        applyCacheEffects(queryClient, 'teams.delete', { id }),
    },
  );
}
