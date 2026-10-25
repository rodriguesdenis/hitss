import Constants from 'expo-constants';

import { cacheBuster } from './persister';

export function appCacheBuster(): string {
  const config = Constants.expoConfig;
  const hash = (config?.extra as { apiContractHash?: string } | undefined)
    ?.apiContractHash;
  return cacheBuster(config?.version ?? '0.0.0', hash ?? 'unknown');
}
