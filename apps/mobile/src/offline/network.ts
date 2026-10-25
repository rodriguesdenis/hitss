import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

let networkOnline = true;
let syncAllowed = false;
const listeners = new Set<() => void>();

function apply() {
  onlineManager.setOnline(networkOnline && syncAllowed);
  listeners.forEach((listener) => listener());
}

export function isReachable(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): boolean {
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

export function startNetwork(): () => void {
  apply();
  return NetInfo.addEventListener((state) => {
    networkOnline = isReachable(state);
    apply();
  });
}

export function setSyncAllowed(allowed: boolean): void {
  syncAllowed = allowed;
  apply();
}

export function isSyncAllowed(): boolean {
  return syncAllowed;
}

export function isNetworkOnline(): boolean {
  return networkOnline;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, isNetworkOnline);
}
