import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
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
  for (const line of text.split(/\r?\n/)) {
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

/**
 * Supported variables: the properties of the classes in apps/api/src/config/env.schema.ts and
 * every `*.env.ts` composed into it. Optional properties (`NAME?:`) are variables the API only
 * rejects (unsupported overrides) and are not documented in .env.example.
 */
function schemaVariables(source) {
  const body = source.slice(source.indexOf('export class'));
  return [...body.matchAll(/^ {2}([A-Z][A-Z0-9_]*)!?:/gm)].map(
    (match) => match[1],
  );
}

const configDir = 'apps/api/src/config/';
const schemaFiles = [
  'env.schema.ts',
  ...readdirSync(fileURLToPath(new URL(configDir, root))).filter((name) =>
    name.endsWith('.env.ts'),
  ),
];
const schema = schemaFiles.flatMap((name) =>
  schemaVariables(read(configDir + name)),
);
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
        defaults.has(name) || schema.includes(name),
        `${name} is used by neither docker-compose.yml nor the API config schema`,
      );
      assert.notEqual(value, '', `${name} has an empty default`);
    }
  });

  it('AC-07.1.4 every API config variable appears in .env.example', () => {
    assert.ok(schema.length > 0);
    for (const name of schema) {
      assert.ok(example.has(name), `${name} is missing from .env.example`);
    }
  });

  it('AC-07.1.5 the database host port is configurable through POSTGRES_PORT', () => {
    assert.ok(defaults.has('POSTGRES_PORT'));
    assert.match(read('docker-compose.yml'), /\$\{POSTGRES_PORT:-\d+\}:5432/);
  });

  it('AC-07.1.5 the database port is published on loopback by default', () => {
    assert.equal(defaults.get('POSTGRES_BIND'), '127.0.0.1');
    assert.match(
      read('docker-compose.yml'),
      /\$\{POSTGRES_BIND:-127\.0\.0\.1\}:\$\{POSTGRES_PORT:-\d+\}:5432/,
    );
  });
});
