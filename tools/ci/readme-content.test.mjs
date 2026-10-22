import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const readme = readFileSync(
  fileURLToPath(new URL('../../README.md', import.meta.url)),
  'utf8',
);

/** The text of an H2 section, up to the next H2. */
function section(title) {
  const start = readme.search(new RegExp(`^## ${title}\\s*$`, 'm'));
  assert.ok(start >= 0, `README has no "${title}" section`);
  const rest = readme.slice(start + 1);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

describe('README content', () => {
  const examples = section('Request examples');

  for (const [name, pattern] of [
    ['sign in as the demo user', /sign-in\/email[\s\S]*demo@teams-tasks\.dev/],
    ['list teams', /curl -s "\$API\/api\/v1\/teams\?/],
    ['create a team', /-X POST \$API\/api\/v1\/teams /],
    ['update a team', /-X PUT \$API\/api\/v1\/teams\//],
    ['delete a team', /-X DELETE \$API\/api\/v1\/teams\//],
    [
      'list tasks with filter, sort and pagination',
      /tasks\?[^"]*status=[^"]*sort=[^"]*limit=[^"]*offset=/,
    ],
    [
      'create a task in two teams',
      /-X POST \$API\/api\/v1\/tasks[\s\S]*teamIds":\["<teamA>","<teamB>"\]/,
    ],
    [
      'change a task status',
      /-X PATCH \$API\/api\/v1\/tasks\/<taskId>\/status/,
    ],
    ['delete a task', /-X DELETE \$API\/api\/v1\/tasks\//],
  ]) {
    it(`AC-07.4.1 the request examples contain a copy-paste command to ${name}`, () => {
      assert.match(examples, pattern);
    });
  }

  it('AC-07.4.6 the data model section has a diagram or textual entity description', () => {
    const model = section('Data model');
    assert.match(model, /```mermaid|erDiagram|\| Entity|teams.*tasks/is);
  });

  it('AC-07.4.6 the data model section explains migrations, seeding and local reproducibility', () => {
    const model = section('Data model');
    assert.match(model, /migrat/i);
    assert.match(model, /seed/i);
    assert.match(model, /reproduc|same schema|fresh machine/i);
  });
});
