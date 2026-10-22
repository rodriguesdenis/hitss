import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { envFilePaths, ignoreEnvFiles } from '../../../src/config/env-files';

describe('envFilePaths', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'env-files-'));
    mkdirSync(join(root, 'apps/api/src/config'), { recursive: true });
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('AC-07.1.4 resolves apps/api/.env and the repository-root .env from the module location', () => {
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');

    expect(envFilePaths(join(root, 'apps/api/src/config'))).toEqual([
      join(root, 'apps/api/.env'),
      join(root, '.env'),
    ]);
  });

  it('AC-07.1.4 resolves the same files from the compiled dist/config directory', () => {
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
    mkdirSync(join(root, 'apps/api/dist/config'), { recursive: true });

    expect(envFilePaths(join(root, 'apps/api/dist/config'))).toEqual([
      join(root, 'apps/api/.env'),
      join(root, '.env'),
    ]);
  });

  it('AC-07.1.4 never reaches outside a repository: without a workspace root only apps/api/.env is used (the image)', () => {
    expect(envFilePaths(join(root, 'apps/api/src/config'))).toEqual([
      join(root, 'apps/api/.env'),
    ]);
  });
});

describe('ignoreEnvFiles', () => {
  it('AC-07.1.4 ignores .env files only when APP_ENV=production', () => {
    expect(ignoreEnvFiles('production')).toBe(true);
    expect(ignoreEnvFiles('local')).toBe(false);
    expect(ignoreEnvFiles('test')).toBe(false);
    expect(ignoreEnvFiles(undefined)).toBe(false);
  });
});
