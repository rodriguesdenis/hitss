import { useMutationState } from '@tanstack/react-query';
import { useMemo } from 'react';

import { isSyncedKey } from './persister';
import { useSyncStore } from './sync.store';

function entityId(variables: unknown): string | undefined {
  const vars = variables as { id?: unknown; tempId?: unknown } | undefined;
  const id = vars?.id ?? vars?.tempId;
  return typeof id === 'string' ? id : undefined;
}

export function pendingLabel(count: number): string {
  if (count === 0) {
    return 'Todas as alterações sincronizadas';
  }
  return count === 1
    ? '1 alteração aguardando sincronização'
    : `${count} alterações aguardando sincronização`;
}

export function tasksTabLabel(pending: boolean): string {
  return pending ? 'Tarefas, alterações aguardando sincronização' : 'Tarefas';
}

export function usePendingSync(): {
  count: number;
  has: (id: string) => boolean;
} {
  const ids = useMutationState({
    filters: {
      status: 'pending',
      predicate: (mutation) => isSyncedKey(mutation.options.mutationKey),
    },
    select: (mutation) => entityId(mutation.state.variables),
  });
  const idMap = useSyncStore((state) => state.idMap);
  const key = ids.join('|');
  return useMemo(() => {
    const pending = new Set<string>();
    for (const id of key ? key.split('|') : []) {
      if (id) {
        pending.add(id);
        const real = idMap[id];
        if (real) {
          pending.add(real);
        }
      }
    }
    return {
      count: key ? key.split('|').length : 0,
      has: (id: string) => pending.has(id),
    };
  }, [key, idMap]);
}
