import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `.env` files to read, resolved from the config directory (`src/config` or `dist/config`, both
 * two levels below `apps/api`) instead of the working directory. The repository-root `.env` is
 * used only when that directory really is the workspace root, so nothing outside the repo
 * (for example `/.env` in the Docker image) is ever read. The first file wins.
 */
export function envFilePaths(configDir: string): string[] {
  const apiDir = join(configDir, '../..');
  const repoRoot = join(apiDir, '../..');
  const paths = [join(apiDir, '.env')];
  if (existsSync(join(repoRoot, 'pnpm-workspace.yaml'))) {
    paths.push(join(repoRoot, '.env'));
  }
  return paths;
}

/** Production configuration comes from the real environment only; a stray .env is never read. */
export function ignoreEnvFiles(appEnv: string | undefined): boolean {
  return appEnv === 'production';
}
