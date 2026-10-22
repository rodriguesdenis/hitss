import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hasMake = spawnSync('make', ['--version']).status === 0;
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
const makefile = readFileSync(`${root}Makefile`, 'utf8');

/** Targets that work today; the rest are listed as pending in `make help`. */
const TARGETS = [
  'help',
  'up',
  'down',
  'logs',
  'reset',
  'test',
  'test-all',
  'test-docker',
  'smoke',
];
const PENDING = [
  'seed',
  'observability',
  'observability-down',
  'mobile',
  'load',
];

const make = (...args) =>
  spawnSync('make', args, { cwd: root, encoding: 'utf8' });

describe('Makefile', { skip: !hasMake && 'make is not installed' }, () => {
  it('AC-07.3.2 every alias passes a dry run (syntax check used in CI)', () => {
    for (const target of TARGETS) {
      const result = make('-n', target);
      assert.equal(result.status, 0, `make -n ${target}: ${result.stderr}`);
    }
  });

  it('AC-07.3.2 maps up, down, logs and reset to docker compose', () => {
    assert.match(
      make('-n', 'up').stdout,
      /docker compose up -d --build --wait/,
    );
    assert.match(make('-n', 'down').stdout, /docker compose down/);
    assert.match(make('-n', 'logs').stdout, /docker compose logs -f api/);
    assert.match(
      make('-n', 'reset').stdout,
      /docker compose down -v[\s\S]*docker compose up -d --build --wait/,
    );
  });

  it('AC-07.3.2 the smoke alias runs the compose smoke script', () => {
    assert.match(make('-n', 'smoke').stdout, /tools\/ci\/compose-smoke\.sh/);
  });

  it('AC-07.3.2 make help is the default goal and lists every alias with a description', () => {
    const bare = make();
    assert.equal(bare.status, 0);
    for (const target of TARGETS.filter((t) => t !== 'help')) {
      assert.match(
        bare.stdout,
        new RegExp(`^\\s*${target}\\s+\\S`, 'm'),
        `${target} is missing from make help`,
      );
    }
  });

  it('AC-07.3.2 make help names the aliases that are not available yet', () => {
    const { stdout } = make('help');
    assert.match(stdout, /not available yet/i);
    for (const target of PENDING) assert.match(stdout, new RegExp(target));
  });

  it('AC-07.3.2 pending aliases are not defined as targets', () => {
    for (const target of PENDING) {
      assert.ok(
        !new RegExp(`^${target}:`, 'm').test(makefile),
        `${target} must not be a target yet`,
      );
    }
  });
});

describe('root scripts', () => {
  it('AC-07.3.1 start and stop drive docker compose', () => {
    assert.equal(pkg.scripts.start, 'docker compose up -d --build --wait');
    assert.equal(pkg.scripts.stop, 'docker compose down');
  });

  it('AC-07.3.1 test runs the unit suites and test:all every suite of every package', () => {
    assert.equal(pkg.scripts.test, 'turbo run test');
    assert.equal(
      pkg.scripts['test:all'],
      'turbo run test test:integration test:e2e',
    );
  });
});
