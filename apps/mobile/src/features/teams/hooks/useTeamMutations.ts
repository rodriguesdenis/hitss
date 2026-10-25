import {
  teamsCreate,
  teamsRemove,
  teamsReplace,
  type CreateTeamDto,
  type UpdateTeamDto,
} from '@hitss/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { applyCacheEffects } from '@/lib/cache-effects';
import { errorMessage } from '@/lib/error-messages';
import { mk } from '@/lib/query-keys';
import { showToast } from '@/ui';

export type CreateTeamVariables = { tempId: string; body: CreateTeamDto };
export type UpdateTeamVariables = { id: string; body: UpdateTeamDto };
export type DeleteTeamVariables = { id: string; name: string };

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mk.teams.create,
    mutationFn: ({ body }: CreateTeamVariables) => teamsCreate(body),
    onSuccess: async (response) => {
      showToast({ message: 'Time criado' });
      await applyCacheEffects(queryClient, 'teams.create', {
        id: response.data.id,
        response,
      });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mk.teams.update,
    mutationFn: ({ id, body }: UpdateTeamVariables) => teamsReplace(id, body),
    onSuccess: async (response, { id }) => {
      showToast({ message: 'Time atualizado' });
      await applyCacheEffects(queryClient, 'teams.update', { id, response });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mk.teams.delete,
    mutationFn: ({ id }: DeleteTeamVariables) => teamsRemove(id),
    onSuccess: async (_response, { id }) => {
      showToast({ message: 'Time excluído' });
      await applyCacheEffects(queryClient, 'teams.delete', { id });
    },
    onError: (error) => {
      showToast({ message: errorMessage(error), tone: 'error' });
    },
  });
}
