import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';

import { createMemoryStorage } from '@/lib/storage';

import {
  renderWithProviders,
  createTestQueryClient,
} from '../../tests/renderWithProviders';
import { setNetwork } from '../../tests/mocks/netinfo';
import { ConnectivityBanner } from './components/ConnectivityBanner';
import { nextPhase } from './use-connectivity-banner';
import { isReachable, setSyncAllowed, startNetwork } from './network';
import { createOfflineRuntime } from './runtime';

const OFFLINE =
  'Você está offline. As alterações serão sincronizadas ao reconectar.';

let stops: (() => void)[] = [];

beforeEach(() => {
  jest.useFakeTimers();
  stops.push(startNetwork());
  setSyncAllowed(true);
});

afterEach(() => {
  stops.forEach((stop) => stop());
  stops = [];
  setSyncAllowed(false);
  jest.useRealTimers();
});

function pausedChange(client: QueryClient) {
  return client.getMutationCache().build(client, {
    mutationKey: ['tasks', 'probe'],
    mutationFn: () => new Promise(() => undefined),
    networkMode: 'online',
    gcTime: Infinity,
  });
}

describe('connectivity', () => {
  it.each([
    [{ isConnected: true, isInternetReachable: true }, true],
    [{ isConnected: true, isInternetReachable: null }, true],
    [{ isConnected: true, isInternetReachable: false }, false],
    [{ isConnected: false, isInternetReachable: null }, false],
    [{ isConnected: null, isInternetReachable: null }, false],
  ])('treats %o as online=%s', (state, online) => {
    expect(isReachable(state)).toBe(online);
  });

  it('keeps React Query offline until sync is allowed', () => {
    setSyncAllowed(false);
    expect(onlineManager.isOnline()).toBe(false);
    setSyncAllowed(true);
    expect(onlineManager.isOnline()).toBe(true);
  });
});

describe('ConnectivityBanner', () => {
  it('AC-05.2.1 appears within a second of losing the connection and hides on return', async () => {
    await renderWithProviders(<ConnectivityBanner />);
    await act(() => setNetwork({ isConnected: false }));
    await act(() => jest.advanceTimersByTimeAsync(999));
    expect(screen.queryByText(OFFLINE)).toBeNull();
    await act(() => jest.advanceTimersByTimeAsync(1));
    expect(screen.getByText(OFFLINE)).toBeOnTheScreen();

    await act(() => setNetwork({ isConnected: true }));
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(screen.queryByText(OFFLINE)).toBeNull();
  });

  it('AC-05.2.1 does not flicker when the connection flaps', async () => {
    await renderWithProviders(<ConnectivityBanner />);
    for (let i = 0; i < 3; i += 1) {
      await act(() => setNetwork({ isConnected: false }));
      await act(() => jest.advanceTimersByTimeAsync(400));
      await act(() => setNetwork({ isConnected: true }));
      await act(() => jest.advanceTimersByTimeAsync(400));
    }
    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('AC-05.2.3 shows syncing, then synced for 2 s, then hides', async () => {
    const queryClient = createTestQueryClient();
    await renderWithProviders(<ConnectivityBanner />, { queryClient });
    await act(() => setNetwork({ isConnected: false }));
    await act(() => jest.advanceTimersByTimeAsync(1000));
    const first = pausedChange(queryClient);
    const second = pausedChange(queryClient);
    void first.execute(undefined);
    void second.execute(undefined);
    await act(() => jest.advanceTimersByTimeAsync(0));

    await act(() => setNetwork({ isConnected: true }));
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(
      screen.getByText('De volta online — sincronizando 2 alterações…'),
    ).toBeOnTheScreen();

    await act(() => {
      queryClient.getMutationCache().remove(first);
      queryClient.getMutationCache().remove(second);
    });
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(
      screen.getByText('Todas as alterações sincronizadas'),
    ).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });
});

describe('reconnect', () => {
  it('AC-05.1.3 sends paused changes before refreshing queries', async () => {
    const queryClient = createTestQueryClient();
    queryClient.mount();
    const runtime = createOfflineRuntime({
      queryClient,
      storage: createMemoryStorage(),
      buster: 'test',
    });
    stops.push(runtime.start());
    const order: string[] = [];
    let release: () => void = () => undefined;
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['tasks', 'probe'],
      networkMode: 'online',
      mutationFn: () =>
        new Promise<void>((resolve) => {
          order.push('mutation sent');
          release = () => {
            order.push('mutation done');
            resolve();
          };
        }),
    });
    const invalidate = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(async () => {
        order.push('invalidate');
      });

    setNetwork({ isConnected: false });
    void mutation.execute(undefined);
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(mutation.state.isPaused).toBe(true);

    setNetwork({ isConnected: true });
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(order).toEqual(['mutation sent']);
    release();
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(order).toEqual(['mutation sent', 'mutation done', 'invalidate']);
    invalidate.mockRestore();
    queryClient.unmount();
    queryClient.clear();
  });
});

describe('banner phases', () => {
  it.each([
    ['idle', false, 0, 'offline'],
    ['synced', false, 2, 'offline'],
    ['offline', true, 2, 'syncing'],
    ['offline', true, 0, 'idle'],
    ['syncing', true, 1, 'syncing'],
    ['syncing', true, 0, 'synced'],
    ['synced', true, 0, 'synced'],
    ['idle', true, 3, 'idle'],
  ] as const)(
    '%s, online %s, %i pending → %s',
    (phase, online, pending, next) => {
      expect(nextPhase(phase, online, pending)).toBe(next);
    },
  );
});
