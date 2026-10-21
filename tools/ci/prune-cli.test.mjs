import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(
  new URL('../../apps/api/prune-cli.cjs', import.meta.url),
);
const dirs = [];

/**
 * Builds a pnpm-style virtual store: .pnpm/<id>/node_modules/<name> is the package, its sibling
 * symlinks are its dependencies, and top-level node_modules/<name> links to the direct dependencies.
 */
function store(packages, direct) {
  const root = mkdtempSync(join(tmpdir(), 'prune-'));
  dirs.push(root);
  const nm = join(root, 'node_modules');
  const idOf = (name) => `${name.replace('/', '+')}@1.0.0`;
  const where = (name) => join(nm, '.pnpm', idOf(name), 'node_modules', name);
  for (const [name] of Object.entries(packages)) {
    mkdirSync(where(name), { recursive: true });
    writeFileSync(join(where(name), 'index.js'), '');
  }
  for (const [name, deps] of Object.entries(packages)) {
    for (const dep of deps) {
      const link = join(nm, '.pnpm', idOf(name), 'node_modules', dep);
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(relative(dirname(link), where(dep)), link);
    }
  }
  for (const name of direct) {
    const link = join(nm, name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(relative(dirname(link), where(name)), link);
  }
  return { nm, has: (name) => existsSync(join(nm, '.pnpm', idOf(name))) };
}

describe('prune the Prisma CLI from the production node_modules', () => {
  after(() =>
    dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
  );

  it('AC-07.1.6 removes the CLI and what only it needs, keeps what the app needs', () => {
    const s = store(
      {
        '@prisma/client': ['prisma', '@prisma/runtime'],
        '@prisma/runtime': [],
        '@prisma/adapter-pg': ['@prisma/runtime', 'pg'],
        pg: [],
        prisma: ['@prisma/studio', 'effect'],
        '@prisma/studio': ['react'],
        react: [],
        effect: [],
      },
      ['@prisma/client', '@prisma/adapter-pg'],
    );
    const run = spawnSync(process.execPath, [script, s.nm, 'prisma'], {
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
    for (const kept of [
      '@prisma/client',
      '@prisma/runtime',
      '@prisma/adapter-pg',
      'pg',
    ]) {
      assert.ok(s.has(kept), `${kept} must stay`);
    }
    for (const gone of ['prisma', '@prisma/studio', 'react', 'effect']) {
      assert.ok(!s.has(gone), `${gone} must be removed`);
    }
  });

  it('AC-07.1.6 keeps a package the CLI shares with the app', () => {
    const s = store(
      {
        app: ['shared'],
        shared: [],
        prisma: ['shared', 'only-cli'],
        'only-cli': [],
        '@prisma/client': ['prisma'],
      },
      ['app', '@prisma/client'],
    );
    assert.equal(
      spawnSync(process.execPath, [script, s.nm, 'prisma']).status,
      0,
    );
    assert.ok(s.has('shared'));
    assert.ok(!s.has('only-cli'));
    assert.ok(!s.has('prisma'));
  });

  it('AC-07.1.6 fails when the named package is a direct dependency (it would be removed by mistake)', () => {
    const s = store({ prisma: [] }, ['prisma']);
    const run = spawnSync(process.execPath, [script, s.nm, 'prisma'], {
      encoding: 'utf8',
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /prisma/);
  });
});
