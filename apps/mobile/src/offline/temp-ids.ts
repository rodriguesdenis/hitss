import { randomUUID } from 'expo-crypto';

import { useSyncStore } from './sync.store';

const TEMP_PREFIX = 'tmp-';

export class UnresolvedTempIdError extends Error {
  readonly tempId: string;

  constructor(tempId: string) {
    super(`The creation of ${tempId} was not confirmed`);
    this.name = 'UnresolvedTempIdError';
    this.tempId = tempId;
  }
}

export function newTempId(): string {
  return `${TEMP_PREFIX}${randomUUID()}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_PREFIX);
}

export function resolveId(id: string): string {
  if (!isTempId(id)) {
    return id;
  }
  const real = useSyncStore.getState().idMap[id];
  if (!real) {
    useSyncStore.getState().failTempId(id);
    throw new UnresolvedTempIdError(id);
  }
  return real;
}

export function useResolvedId(id: string): string {
  return useSyncStore((state) => (isTempId(id) ? (state.idMap[id] ?? id) : id));
}
