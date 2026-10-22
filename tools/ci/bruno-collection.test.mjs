import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const collection = join(root, 'tools', 'bruno', 'teams-tasks');
const read = (...parts) => readFileSync(join(collection, ...parts), 'utf8');

const requests = readdirSync(collection, { recursive: true })
  .filter(
    (file) =>
      file.endsWith('.bru') &&
      !file.startsWith('environments') &&
      !/(^|\/)(folder|collection)\.bru$/.test(file),
  )
  .map((file) => ({ file, text: read(file) }));

describe('Bruno collection', () => {
  it('AC-07.4.2 has a local environment with the base URL', () => {
    assert.match(
      read('environments', 'local.bru'),
      /baseUrl:\s*http:\/\/localhost:3000/,
    );
  });

  it('AC-07.4.2 sign-in saves the session token and the collection sends it as a bearer token', () => {
    assert.match(
      read('01-auth', 'sign-in.bru'),
      /bru\.setVar\("token", res\.headers\["set-auth-token"\]\)/,
    );
    const collectionFile = read('collection.bru');
    assert.match(collectionFile, /mode:\s*bearer/);
    assert.match(collectionFile, /token:\s*\{\{token\}\}/);
  });

  it('AC-07.4.2 every request but health, sign-up and sign-in inherits that authorization', () => {
    for (const { file, text } of requests) {
      const anonymous = /^(00-health|01-auth\/sign-(up|in))/.test(file);
      assert.match(text, anonymous ? /auth:\s*none/ : /auth:\s*inherit/, file);
    }
  });

  it('AC-07.4.4 every request asserts its status', () => {
    for (const { file, text } of requests) {
      assert.match(text, /assert\s*\{[^}]*res\.status:/, file);
    }
  });

  it('AC-07.4.4 the compose smoke runs the pinned Bruno CLI against the seeded stack and fails on a bad assertion', () => {
    const smoke = readFileSync(
      join(root, 'tools', 'ci', 'compose-smoke.sh'),
      'utf8',
    );
    assert.match(smoke, /@usebruno\/cli@\d+\.\d+\.\d+ run --env local/);
    assert.match(smoke, /\|\| fail 'the Bruno collection/);
  });

  it('AC-07.4.4 requests that create data delete it in the cleanup folder, which runs before sign-out', () => {
    const cleanup = readdirSync(join(collection, '98-cleanup')).join(' ');
    assert.match(cleanup, /delete-task/);
    assert.match(cleanup, /delete-team/);
    assert.match(read('98-cleanup', 'folder.bru'), /seq:\s*8/);
    assert.match(read('99-sign-out', 'folder.bru'), /seq:\s*9/);
  });
});
