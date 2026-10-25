import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workflow = parse(readFileSync(`${root}.github/workflows/ci.yml`, 'utf8'));
const mobile = JSON.parse(
  readFileSync(`${root}apps/mobile/package.json`, 'utf8'),
);

const commandsOf = (job) =>
  (workflow.jobs[job].steps ?? []).map((step) => step.run ?? '').join('\n');

describe('Mobile CI (AC-07.6.1)', () => {
  it('AC-07.6.1 mobile lint, typecheck and tests gate ci-success', () => {
    const needs = workflow.jobs['ci-success'].needs;
    assert.ok(needs.includes('mobile-static'));
    assert.ok(needs.includes('mobile-unit'));
  });

  it('AC-07.6.1 mobile-static lints (ESLint and dependency-cruiser) and typechecks the app and the api-client', () => {
    assert.match(
      commandsOf('mobile-static'),
      /turbo run lint typecheck --filter=@hitss\/mobile --filter=@hitss\/api-client/,
    );
    assert.match(mobile.scripts.lint, /eslint/);
    assert.match(mobile.scripts.lint, /depcruise/);
  });

  it('AC-07.6.1 mobile-unit runs the api-client tests and the mobile tests with coverage', () => {
    const commands = commandsOf('mobile-unit');
    assert.match(commands, /turbo run test --filter=@hitss\/api-client$/m);
    assert.match(
      commands,
      /turbo run test --filter=@hitss\/mobile -- --coverage/,
    );
    assert.match(mobile.scripts.test, /&& jest$/);
  });

  it('AC-07.6.1 the API jobs are filtered to the API so mobile work is not run twice', () => {
    assert.match(
      commandsOf('static'),
      /turbo run lint typecheck --filter=@hitss\/api$/m,
    );
    assert.match(
      commandsOf('unit'),
      /turbo run test --filter=@hitss\/api -- --coverage/,
    );
  });
});
