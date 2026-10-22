import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  brunoRequestNames,
  checkParity,
  httpRequestNames,
} from './request-parity.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'parity-'));
  const bruno = join(root, 'bruno');
  const http = join(root, 'http');
  mkdirSync(join(bruno, 'a'), { recursive: true });
  mkdirSync(http);
  writeFileSync(
    join(bruno, 'a', 'one.bru'),
    'meta {\n  name: Create team\n  type: http\n  seq: 1\n}\n',
  );
  writeFileSync(
    join(bruno, 'a', 'folder.bru'),
    'meta {\n  name: Teams\n  seq: 1\n}\n',
  );
  writeFileSync(
    join(bruno, 'two.bru'),
    'meta {\n  name: Liveness\n  type: http\n  seq: 2\n}\n',
  );
  writeFileSync(
    join(http, 'x.http'),
    '### Create team\nPOST http://x\n\n### Liveness\nGET http://y\n',
  );
  return { bruno, http };
}

describe('request parity (Bruno and .http)', () => {
  it('AC-07.4.3 reads request names from Bruno files, ignoring folder and collection files', () => {
    const { bruno } = fixture();
    assert.deepEqual(brunoRequestNames(bruno).sort(), [
      'Create team',
      'Liveness',
    ]);
  });

  it('AC-07.4.3 reads request names from ### headings of .http files', () => {
    const { http } = fixture();
    assert.deepEqual(httpRequestNames(http).sort(), [
      'Create team',
      'Liveness',
    ]);
  });

  it('AC-07.4.3 passes when every Bruno request has a .http twin', () => {
    const { bruno, http } = fixture();
    assert.deepEqual(checkParity(bruno, http), []);
  });

  it('AC-07.4.3 names the Bruno request that has no .http twin', () => {
    const { bruno, http } = fixture();
    writeFileSync(
      join(bruno, 'three.bru'),
      'meta {\n  name: Delete team\n  type: http\n  seq: 3\n}\n',
    );
    assert.deepEqual(checkParity(bruno, http), ['Delete team']);
  });

  it('AC-07.4.3 the committed collection and request files are in parity', () => {
    const root = new URL('../', import.meta.url).pathname;
    assert.deepEqual(
      checkParity(join(root, 'bruno', 'teams-tasks'), join(root, 'http')),
      [],
    );
  });
});
