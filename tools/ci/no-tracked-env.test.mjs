import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { findTrackedEnvFiles } from './no-tracked-env.mjs';

describe('tracked .env guard', () => {
  it('AC-07.6.7 accepts .env.example only', () => {
    assert.deepEqual(
      findTrackedEnvFiles([
        '.env.example',
        'apps/api/.env.example',
        'README.md',
      ]),
      [],
    );
  });

  it('AC-07.6.7 rejects .env and any .env.* variant at any depth', () => {
    const tracked = [
      '.env',
      'apps/api/.env.local',
      'apps/mobile/.env.production',
      '.env.example',
    ];
    assert.deepEqual(findTrackedEnvFiles(tracked), [
      '.env',
      'apps/api/.env.local',
      'apps/mobile/.env.production',
    ]);
  });

  it('AC-07.6.7 rejects .envrc (direnv files commonly hold exports)', () => {
    assert.deepEqual(findTrackedEnvFiles(['.envrc', 'apps/api/.envrc']), [
      '.envrc',
      'apps/api/.envrc',
    ]);
  });

  it('AC-07.6.7 ignores files that merely contain "env" in the name', () => {
    assert.deepEqual(
      findTrackedEnvFiles([
        'docs/env.md',
        'tools/ci/env-example.test.mjs',
        'src/config/.environment.ts',
      ]),
      [],
    );
  });
});
