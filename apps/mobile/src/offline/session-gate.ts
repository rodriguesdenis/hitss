import { isNetworkOnline, setSyncAllowed } from './network';

export type SessionGate = {
  verify: () => Promise<boolean>;
  revoke: () => void;
};

export function createSessionGate({
  getSessionUserId,
  claim,
  onSessionLost,
}: {
  getSessionUserId: () => Promise<string | null>;
  claim: (userId: string) => Promise<void>;
  onSessionLost: () => void;
}): SessionGate {
  let generation = 0;

  return {
    verify: async () => {
      const current = ++generation;
      if (!isNetworkOnline()) {
        setSyncAllowed(false);
        return false;
      }
      let userId: string | null;
      try {
        userId = await getSessionUserId();
      } catch {
        setSyncAllowed(false);
        return false;
      }
      if (current !== generation) {
        return false;
      }
      if (!userId) {
        setSyncAllowed(false);
        onSessionLost();
        return false;
      }
      await claim(userId);
      if (current !== generation) {
        return false;
      }
      setSyncAllowed(true);
      return true;
    },
    revoke: () => {
      generation += 1;
      setSyncAllowed(false);
    },
  };
}
