import { ApiError } from '@hitss/api-client';
import { focusManager } from '@tanstack/react-query';

import {
  createQueryClient as create,
  onAppStateChange,
  shouldRetry,
} from './query-client';

const unauthenticated = new ApiError(401, {
  error: { code: 'UNAUTHENTICATED', message: 'x', traceId: 't' },
});

const clients: ReturnType<typeof create>[] = [];

function createQueryClient(...args: Parameters<typeof create>) {
  const client = create(...args);
  clients.push(client);
  return client;
}

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

describe('query client', () => {
  it('uses the plan defaults', () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions();
    expect(queries).toMatchObject({
      staleTime: 30_000,
      gcTime: 86_400_000,
      networkMode: 'offlineFirst',
    });
    expect(mutations).toMatchObject({
      networkMode: 'offlineFirst',
      retry: false,
    });
  });

  it.each([
    ['a network failure', new TypeError('Network request failed'), true],
    ['a 5xx', new ApiError(503, undefined), true],
    ['a 4xx', new ApiError(404, undefined), false],
    ['a 401', unauthenticated, false],
  ])('retries %s: %s', (_label, error, retried) => {
    expect(shouldRetry(0, error)).toBe(retried);
  });

  it('stops after three retries', () => {
    const error = new TypeError('Network request failed');
    expect(shouldRetry(2, error)).toBe(true);
    expect(shouldRetry(3, error)).toBe(false);
  });

  it('AC-04.1.6 calls onUnauthenticated when a query gets a 401', async () => {
    const onUnauthenticated = jest.fn();
    const client = createQueryClient({ onUnauthenticated });
    await client
      .fetchQuery({
        queryKey: ['x'],
        queryFn: () => Promise.reject(unauthenticated),
        retry: false,
      })
      .catch(() => undefined);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('AC-04.1.6 calls onUnauthenticated when a mutation gets a 401', async () => {
    const onUnauthenticated = jest.fn();
    const client = createQueryClient({ onUnauthenticated });
    await client
      .getMutationCache()
      .build(client, {
        mutationFn: () => Promise.reject(unauthenticated),
        gcTime: 0,
      })
      .execute(undefined)
      .catch(() => undefined);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('ignores other errors', async () => {
    const onUnauthenticated = jest.fn();
    const client = createQueryClient({ onUnauthenticated });
    await client
      .fetchQuery({
        queryKey: ['x'],
        queryFn: () => Promise.reject(new ApiError(403, undefined)),
        retry: false,
      })
      .catch(() => undefined);
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('maps AppState to focus', () => {
    onAppStateChange('background');
    expect(focusManager.isFocused()).toBe(false);
    onAppStateChange('active');
    expect(focusManager.isFocused()).toBe(true);
  });
});
