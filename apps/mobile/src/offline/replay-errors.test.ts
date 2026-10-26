import { ApiError, ApiNetworkError, ApiTimeoutError } from '@hitss/api-client';
import { QueryClient } from '@tanstack/react-query';

import { afterQueueDrains, retryDelay } from './durable-mutation';
import { classifyReplayError, type MutationKind } from './replay-errors';
import { useSyncStore } from './sync.store';
import {
  isTempId,
  newTempId,
  resolveId,
  UnresolvedTempIdError,
} from './temp-ids';

const api = (status: number, retryAfter?: number) =>
  new ApiError(status, undefined, retryAfter);

describe('classifyReplayError', () => {
  it.each<[unknown, MutationKind, string]>([
    [api(404), 'delete', 'success'],
    [api(404), 'status', 'gone'],
    [api(404), 'update', 'gone'],
    [api(400), 'update', 'rejected'],
    [api(409), 'create', 'rejected'],
    [api(422), 'create', 'rejected'],
    [api(403), 'status', 'rejected'],
    [api(401), 'status', 'unauthenticated'],
    [api(429), 'status', 'retry'],
    [api(500), 'delete', 'retry'],
    [api(503), 'create', 'retry'],
    [new TypeError('Network request failed'), 'update', 'retry'],
    [
      new ApiNetworkError(new Error('fetch failed: Unable to resolve host')),
      'create',
      'retry',
    ],
    [new ApiTimeoutError(15_000), 'update', 'retry'],
    [new UnresolvedTempIdError('tmp-1'), 'status', 'dependency-failed'],
    [new Error('boom'), 'status', 'rejected'],
  ])('%p on %s → %s', (error, kind, decision) => {
    expect(classifyReplayError(error, kind)).toBe(decision);
  });
});

describe('retryDelay', () => {
  it('backs off exponentially up to 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => retryDelay(n, api(503)))).toEqual([
      1000, 2000, 4000, 8000, 16_000, 30_000, 30_000,
    ]);
  });

  it('honours Retry-After', () => {
    expect(retryDelay(0, api(429, 12))).toBe(12_000);
  });
});

describe('temporary ids', () => {
  beforeEach(() => {
    useSyncStore.setState({ idMap: {}, failedTmpIds: [] });
  });

  it('creates unique tmp-<uuid> ids', () => {
    const a = newTempId();
    expect(a).toMatch(/^tmp-[0-9a-f-]{36}$/);
    expect(newTempId()).not.toBe(a);
    expect(isTempId(a)).toBe(true);
    expect(isTempId('task-1')).toBe(false);
  });

  it('AC-05.5.3 resolves a confirmed creation to its real id', () => {
    useSyncStore.getState().mapId('tmp-a', 'team-1');
    expect(resolveId('tmp-a')).toBe('team-1');
    expect(resolveId('team-2')).toBe('team-2');
  });

  it('AC-05.5.6 fails a dependant of an unconfirmed creation without sending it', () => {
    expect(() => resolveId('tmp-b')).toThrow(UnresolvedTempIdError);
    expect(useSyncStore.getState().failedTmpIds).toEqual(['tmp-b']);
  });
});

describe('afterQueueDrains', () => {
  it('runs effects only once no synced mutation is in flight', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { gcTime: 0 } },
    });
    let release: () => void = () => undefined;
    const pending = client
      .getMutationCache()
      .build(client, {
        mutationKey: ['tasks', 'update'],
        mutationFn: () => new Promise<void>((resolve) => (release = resolve)),
      })
      .execute(undefined);
    const effect = jest.fn();
    afterQueueDrains(client, effect);
    afterQueueDrains(client, effect);
    await Promise.resolve();
    expect(effect).not.toHaveBeenCalled();
    release();
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(effect).toHaveBeenCalledTimes(2);
    client.clear();
  });
});
