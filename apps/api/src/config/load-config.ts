import { toAppConfig, type AppConfig } from './app-config';
import { envFilePaths, ignoreEnvFiles } from './env-files';
import { validate } from './env.validation';

/**
 * Loads the same .env files as the config module (real environment variables win, nothing in
 * production) into the process environment. For standalone entry points such as the seed.
 */
export function loadEnvFiles(configDir: string = __dirname): void {
  if (ignoreEnvFiles(process.env.APP_ENV)) return;
  for (const path of envFilePaths(configDir)) {
    try {
      process.loadEnvFile(path);
    } catch {
      // A missing .env is normal; real environment variables are enough.
    }
  }
}

/** The validated application config for a standalone process; throws naming the bad variable. */
export function loadAppConfig(
  env: Record<string, unknown> = process.env,
): AppConfig {
  return toAppConfig(validate({ ...env }));
}
