import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function envFilePaths(configDir: string): string[] {
  const apiDir = join(configDir, '../..');
  const repoRoot = join(apiDir, '../..');
  const paths = [join(apiDir, '.env')];
  if (existsSync(join(repoRoot, 'pnpm-workspace.yaml'))) {
    paths.push(join(repoRoot, '.env'));
  }
  return paths;
}

export function ignoreEnvFiles(appEnv: string | undefined): boolean {
  return appEnv === 'production';
}
