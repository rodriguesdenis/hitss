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
  'seed',
  'test',
  'test-all',
  'test-docker',
  'smoke',
];
/** Aliases for things that are not in the repository: `make help` must not advertise them. */
const ABSENT = ['observability', 'observability-down', 'mobile', 'load'];

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

  it('AC-07.3.2 test-docker uses the same pinned Node image as the API Dockerfile', () => {
    const dockerfile = readFileSync(`${root}apps/api/Dockerfile`, 'utf8');
    const pinned = /^ARG NODE_IMAGE=(\S+)$/m.exec(dockerfile)?.[1];
    assert.ok(
      pinned && pinned.includes('@sha256:'),
      'the Dockerfile pins NODE_IMAGE by digest',
    );
    const recipe = make('-n', 'test-docker').stdout;
    assert.ok(recipe.includes(pinned), `test-docker must use ${pinned}`);
    assert.ok(!/node:24\s/.test(recipe), 'no floating node:24');
  });

  it('AC-07.3.2 test-docker mounts the Docker socket only for the suites that need it', () => {
    assert.ok(
      !make('-n', 'test-docker').stdout.includes('docker.sock'),
      'unit tests need no socket',
    );
    const all = make('-n', 'test-docker', 'TARGET=test:all').stdout;
    assert.ok(all.includes('/var/run/docker.sock'));
    assert.ok(all.includes('TESTCONTAINERS_HOST_OVERRIDE'));
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

  it('AC-07.3.2 make help lists only aliases that exist: nothing for the telemetry backend, Metro or k6', () => {
    const { stdout } = make('help');
    assert.doesNotMatch(stdout, /not available yet/i);
    for (const target of ABSENT) {
      assert.doesNotMatch(stdout, new RegExp(`^\\s+${target}\\b`, 'm'));
    }
    const listed = [...stdout.matchAll(/^ {2}([a-z-]+) /gm)].map((m) => m[1]);
    assert.deepEqual(listed.sort(), [...TARGETS].sort());
  });

  it('AC-07.3.2 aliases for things that do not exist are not defined as targets', () => {
    for (const target of ABSENT) {
      assert.ok(
        !new RegExp(`^${target}:`, 'm').test(makefile),
        `${target} must not be a target`,
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
