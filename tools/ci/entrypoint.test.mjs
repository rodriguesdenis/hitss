import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const entrypoint = fileURLToPath(
  new URL('../../apps/api/docker-entrypoint.sh', import.meta.url),
);

/** Runs the entrypoint with a fake `node` that records its arguments; returns the calls. */
function run(env) {
  const dir = mkdtempSync(join(tmpdir(), 'entrypoint-'));
  const log = join(dir, 'calls.log');
  const fake = join(dir, 'node');
  writeFileSync(fake, `#!/bin/sh\necho "$*" >> "${log}"\n`);
  chmodSync(fake, 0o755);
  const result = spawnSync('sh', [entrypoint], {
    env: { PATH: `${dir}:/usr/bin:/bin`, DATABASE_URL: 'set-by-test', ...env },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return readFileSync(log, 'utf8').trim().split('\n');
}

describe('docker-entrypoint.sh seed step', () => {
  it('AC-07.2.6 seeds before starting the API by default', () => {
    const calls = run({});
    assert.equal(calls[0], 'dist/seed/run.js');
    assert.match(calls[1], /dist\/main\.js$/);
  });

  it('AC-07.2.6 SEED_ON_START=false starts the API without running the seed', () => {
    const calls = run({ SEED_ON_START: 'false' });
    assert.equal(calls.length, 1);
    assert.match(calls[0], /dist\/main\.js$/);
  });
});
