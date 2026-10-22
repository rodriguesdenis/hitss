import { toAppConfig, type AppConfig } from './app-config';
import { envFilePaths, ignoreEnvFiles } from './env-files';
import { validate } from './env.validation';

export function loadEnvFiles(configDir: string = __dirname): void {
  if (ignoreEnvFiles(process.env.APP_ENV)) return;
  for (const path of envFilePaths(configDir)) {
    try {
      process.loadEnvFile(path);
    } catch {
      continue;
    }
  }
}

export function loadAppConfig(
  env: Record<string, unknown> = process.env,
): AppConfig {
  return toAppConfig(validate({ ...env }));
}
