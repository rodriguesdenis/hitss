import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const config = fileURLToPath(new URL('../../.gitleaks.toml', import.meta.url));
const hasGitleaks = spawnSync('gitleaks', ['version']).status === 0;
const badge =
  '[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456';
// Built at runtime so this file does not itself look like a leaked secret.
const planted = ['AKIA', 'IOSFODNN7REALKEY'].join('');
const otherToken = ['Zk3pQ9xV7m', 'Lw2RtY8nBc4h'].join('');

const workdirs = [];
/** Exit code of `gitleaks dir` over a README holding the given lines. */
function scan(lines) {
  const dir = mkdtempSync(join(tmpdir(), 'gitleaks-'));
  workdirs.push(dir);
  mkdirSync(join(dir, 'apps/api'), { recursive: true });
  writeFileSync(join(dir, 'apps/api/README.md'), `${lines.join('\n')}\n`);
  return spawnSync('gitleaks', [
    'dir',
    '--no-banner',
    '--redact',
    '--config',
    config,
    dir,
  ]).status;
}

describe(
  'gitleaks config',
  {
    skip: !hasGitleaks && 'gitleaks not installed (runs in the CI secrets job)',
  },
  () => {
    after(() =>
      workdirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
    );

    it('AC-07.6.7 allows the known Nest badge URL', () => {
      assert.equal(scan([badge]), 0);
    });

    it('AC-07.6.7 still detects a real key planted in apps/api/README.md', () => {
      assert.equal(scan([badge, `aws_access_key_id = ${planted}`]), 1);
    });

    it('AC-07.6.7 does not allowlist other tokens on the same badge host', () => {
      assert.equal(
        scan([
          `[x]: https://img.shields.io/circleci/build/github/acme/app/master?token=${otherToken}`,
        ]),
        1,
      );
    });
  },
);
