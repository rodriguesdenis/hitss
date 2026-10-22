import type { AppConfig } from '../config/app-config';

export function demoSeedSkipReason(
  config: Pick<AppConfig, 'seedDemo' | 'appEnv'>,
): string | undefined {
  if (config.appEnv === 'production') return 'APP_ENV=production';
  if (!config.seedDemo) return 'SEED_DEMO=false';
  return undefined;
}
