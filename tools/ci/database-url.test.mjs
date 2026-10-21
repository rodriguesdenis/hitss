import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = `${root}apps/api/database-url.cjs`;
// Built at runtime: no literal credentials in this source.
const pw = (...parts) => parts.join('');

/** Runs the script with exactly these environment variables. */
function run(env) {
  return spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
}

const base = {
  POSTGRES_USER: 'teams',
  POSTGRES_HOST: 'postgres',
  POSTGRES_PORT: '5432',
  POSTGRES_DB: 'teams_tasks',
};

describe('API container DATABASE_URL builder', () => {
  it('AC-07.1.4 builds the URL from the POSTGRES_* parts', () => {
    const password = pw('local', 'only');
    const { status, stdout } = run({ ...base, POSTGRES_PASSWORD: password });
    assert.equal(status, 0);
    assert.equal(
      stdout,
      `postgresql://teams:${password}@postgres:5432/teams_tasks`,
    );
  });

  it('AC-07.1.4 percent-encodes characters that would break the URL', () => {
    const password = pw('p@ss', ':w/rd', '#?%');
    const { stdout } = run({ ...base, POSTGRES_PASSWORD: password });
    const url = new URL(stdout);
    assert.equal(decodeURIComponent(url.password), password);
    assert.equal(url.hostname, 'postgres');
    assert.equal(url.pathname, '/teams_tasks');
    assert.ok(
      !stdout.includes(password),
      'raw password must not appear unencoded',
    );
  });

  it('AC-07.1.4 names a missing variable without echoing any value', () => {
    const password = pw('sec', 'ret');
    const { status, stderr, stdout } = run({
      ...base,
      POSTGRES_PASSWORD: password,
      POSTGRES_HOST: '',
    });
    assert.notEqual(status, 0);
    assert.match(stderr, /POSTGRES_HOST/);
    assert.ok(!(stderr + stdout).includes(password));
  });
});

describe('docker-compose.yml credentials', () => {
  const compose = readFileSync(`${root}docker-compose.yml`, 'utf8');
  const lines = compose
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'));

  it('AC-07.1.4 never inlines credentials in a URL', () => {
    const offenders = lines.filter((line) =>
      /:\/\/[^/\s]*:[^@\s]*@/.test(line),
    );
    assert.deepEqual(offenders, []);
  });

  it('AC-07.1.4 the api service gets the POSTGRES_* parts, not a DATABASE_URL', () => {
    const api = compose.slice(compose.indexOf('\n  api:'));
    assert.ok(!/^\s+DATABASE_URL:/m.test(api));
    for (const name of [
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_HOST',
      'POSTGRES_PORT',
      'POSTGRES_DB',
    ]) {
      assert.match(
        api,
        new RegExp(`\\b${name}:`),
        `${name} missing from the api service`,
      );
    }
  });
});
