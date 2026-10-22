import type { AppConfig } from '../config/app-config';

/**
 * Why the demo account and its data must not be seeded, or undefined when they may be. The same
 * rules are enforced when the configuration is validated (SEED_DEMO is refused in production);
 * checking again here is defence in depth (ADR-0004).
 */
export function demoSeedSkipReason(
  config: Pick<AppConfig, 'seedDemo' | 'appEnv'>,
): string | undefined {
  if (config.appEnv === 'production') return 'APP_ENV=production';
  if (!config.seedDemo) return 'SEED_DEMO=false';
  return undefined;
}
