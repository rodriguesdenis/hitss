import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), 'utf8');

/** `${VAR:-default}` references in compose; `$${VAR}` (container-side escapes) are ignored. */
function composeDefaults(compose) {
  const defaults = new Map();
  for (const [, name, value] of compose.matchAll(
    /(?<!\$)\$\{([A-Z0-9_]+):-([^}]*)\}/g,
  )) {
    defaults.set(name, value);
  }
  return defaults;
}

/** `KEY=value` lines of an env file, with the comment block directly above each. */
function envEntries(text) {
  const entries = new Map();
  let comment = '';
  for (const line of text.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) {
      entries.set(match[1], { value: match[2], comment });
      comment = '';
    } else {
      comment = line.startsWith('#') ? line : '';
    }
  }
  return entries;
}

const defaults = composeDefaults(read('docker-compose.yml'));
const example = envEntries(read('.env.example'));

describe('.env.example parity with docker-compose.yml', () => {
  it('AC-07.1.4 compose declares at least one defaulted variable', () => {
    assert.ok(defaults.size > 0);
  });

  it('AC-07.1.4 every compose variable appears in .env.example with the same default', () => {
    for (const [name, value] of defaults) {
      assert.ok(example.has(name), `${name} is missing from .env.example`);
      assert.equal(example.get(name).value, value, `${name} default differs`);
    }
  });

  it('AC-07.1.4 every .env.example variable has a description and a default', () => {
    for (const [name, { value, comment }] of example) {
      assert.ok(comment, `${name} has no comment above it`);
      assert.ok(
        defaults.has(name),
        `${name} is not used by docker-compose.yml`,
      );
      assert.notEqual(value, undefined);
    }
  });

  it('AC-07.1.5 the database host port is configurable through POSTGRES_PORT', () => {
    assert.ok(defaults.has('POSTGRES_PORT'));
    assert.match(read('docker-compose.yml'), /\$\{POSTGRES_PORT:-\d+\}:5432/);
  });
});
