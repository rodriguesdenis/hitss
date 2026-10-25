import { onlineManager, type UseMutationResult } from '@tanstack/react-query';

import { showToast } from '@/ui';

import { QUEUED_MESSAGE } from './messages';

export type SubmitResult<TData> =
  { outcome: 'saved'; data: TData } | { outcome: 'queued' };

export async function submitDurable<TData, TError, TVariables>(
  mutation: Pick<
    UseMutationResult<TData, TError, TVariables>,
    'mutate' | 'mutateAsync'
  >,
  variables: TVariables,
): Promise<SubmitResult<TData>> {
  if (!onlineManager.isOnline()) {
    mutation.mutate(variables);
    showToast({ message: QUEUED_MESSAGE });
    return { outcome: 'queued' };
  }
  return { outcome: 'saved', data: await mutation.mutateAsync(variables) };
}
