import type {
  ApiError,
  ApiErrorResponseDto,
  TeamsCreate201,
  TeamsReplace200,
} from '@hitss/api-client';
import { useMutation } from '@tanstack/react-query';

import { mk } from '@/lib/query-keys';

import type {
  TeamCreateVars,
  TeamDeleteVars,
  TeamUpdateVars,
} from '../mutations';

export type CreateTeamVariables = TeamCreateVars;
export type UpdateTeamVariables = TeamUpdateVars;
export type DeleteTeamVariables = TeamDeleteVars;

type Failure = ApiError<ApiErrorResponseDto>;

export function useCreateTeam() {
  return useMutation<TeamsCreate201, Failure, TeamCreateVars>({
    mutationKey: mk.teams.create,
  });
}

export function useUpdateTeam() {
  return useMutation<TeamsReplace200, Failure, TeamUpdateVars>({
    mutationKey: mk.teams.update,
  });
}

export function useDeleteTeam() {
  return useMutation<unknown, Failure, TeamDeleteVars>({
    mutationKey: mk.teams.delete,
  });
}
