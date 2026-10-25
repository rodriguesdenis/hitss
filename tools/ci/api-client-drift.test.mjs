import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workflow = parse(readFileSync(`${root}.github/workflows/ci.yml`, 'utf8'));
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
const script = readFileSync(`${root}tools/ci/api-client-drift.sh`, 'utf8');

describe('API client contract drift (US-07.8)', () => {
  it('AC-07.8.1 the contract job runs the drift check and gates ci-success', () => {
    const steps = workflow.jobs.contract.steps.map((step) => step.run ?? '');
    assert.ok(steps.includes('tools/ci/api-client-drift.sh'));
    assert.ok(workflow.jobs['ci-success'].needs.includes('contract'));
  });

  it('AC-07.8.1 the check regenerates from an offline export, then fails showing the diff', () => {
    assert.match(pkg.scripts['api-client:generate'], /openapi:export/);
    assert.match(
      pkg.scripts['api-client:generate'],
      /turbo run generate --filter=@hitss\/api-client/,
    );
    assert.match(script, /pnpm api-client:generate/);
    assert.match(script, /git status --porcelain -- packages\/api-client/);
    assert.match(script, /git diff -- packages\/api-client \| head -n 200/);
    assert.match(script, /exit 1/);
  });

  it('AC-07.8.4 the contract and the generated client are excluded from formatting', () => {
    const ignored = readFileSync(`${root}.prettierignore`, 'utf8').split('\n');
    assert.ok(ignored.includes('packages/api-client/openapi.json'));
    assert.ok(ignored.includes('packages/api-client/src/generated'));
  });
});
