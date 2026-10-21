import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = parse(readFileSync(`${root}.github/dependabot.yml`, 'utf8'));
const updates = config.updates;

describe('.github/dependabot.yml', () => {
  it('AC-07.9.3 covers packages, pipeline actions and container images, weekly', () => {
    const ecosystems = updates.map((u) => u['package-ecosystem']);
    for (const wanted of ['npm', 'github-actions', 'docker-compose']) {
      assert.ok(ecosystems.includes(wanted), `${wanted} missing`);
    }
    for (const update of updates) {
      assert.equal(update.schedule.interval, 'weekly');
    }
  });

  it('AC-07.9.3 groups related npm updates', () => {
    const npm = updates.find((u) => u['package-ecosystem'] === 'npm');
    assert.ok(Object.keys(npm.groups).length >= 3);
  });

  it('AC-07.9.3 never includes the scope (it would produce a commit type commitlint rejects)', () => {
    for (const update of updates) {
      assert.equal(update['commit-message']['include'], undefined);
    }
  });

  it('AC-07.9.3 commit messages built from each prefix pass commitlint', () => {
    for (const update of updates) {
      const prefix = update['commit-message'].prefix;
      const message = `${prefix}: bump example-package from 1.0.0 to 1.0.1`;
      const run = spawnSync('pnpm', ['exec', 'commitlint'], {
        cwd: root,
        input: message,
        encoding: 'utf8',
      });
      assert.equal(
        run.status,
        0,
        `"${message}" rejected:\n${run.stdout}${run.stderr}`,
      );
    }
  });
});
