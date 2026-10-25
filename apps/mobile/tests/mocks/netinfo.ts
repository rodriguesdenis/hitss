type State = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};
type Listener = (state: State) => void;

const listeners = new Set<Listener>();
let current: State = { isConnected: true, isInternetReachable: true };

export function setNetwork(next: Partial<State>): void {
  current = { ...current, ...next };
  listeners.forEach((listener) => listener(current));
}

export function resetNetwork(): void {
  listeners.clear();
  current = { isConnected: true, isInternetReachable: true };
}

const NetInfo = {
  addEventListener: (listener: Listener) => {
    listeners.add(listener);
    listener(current);
    return () => {
      listeners.delete(listener);
    };
  },
  fetch: async () => current,
};

export default NetInfo;
