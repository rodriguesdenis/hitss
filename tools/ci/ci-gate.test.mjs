import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workflow = parse(readFileSync(`${root}.github/workflows/ci.yml`, 'utf8'));
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));

const required = workflow.jobs['ci-success'].needs;
const commandsOf = (job) =>
  (workflow.jobs[job].steps ?? []).map((step) => step.run ?? '').join('\n');
const gateCommands = required.map(commandsOf).join('\n');

/** The checks AC-08.8 keeps in the required gate. */
const REQUIRED_JOBS = [
  'commitlint', // commit messages
  'static', // format, lint, typecheck, architecture rules
  'secrets', // gitleaks
  'audit', // dependency audit
  'unit',
  'integration', // integration and e2e
  'build',
  'compose-smoke',
];

describe('CI gate (AC-08.8)', () => {
  it('AC-08.8 ci-success needs lint, typecheck, unit, integration, e2e, build, compose smoke, gitleaks, audit and commitlint', () => {
    for (const job of REQUIRED_JOBS) {
      assert.ok(required.includes(job), `${job} must gate ci-success`);
      assert.ok(workflow.jobs[job], `job ${job} must exist`);
    }
    assert.match(commandsOf('static'), /turbo run lint typecheck/);
    assert.match(commandsOf('integration'), /test:integration test:e2e/);
    assert.match(commandsOf('unit'), /turbo run test/);
  });

  it('AC-08.8 no required job runs the traceability, README or production-readiness checks', () => {
    for (const forbidden of [
      /traceability/,
      /doc-check/,
      /test:docs/,
      /production-readiness/,
    ]) {
      assert.doesNotMatch(gateCommands, forbidden);
    }
  });

  it('AC-08.8 the document checks run in a job that is not part of the gate', () => {
    const docs = workflow.jobs['docs-checks'];
    assert.ok(docs, 'docs-checks job exists');
    assert.ok(!required.includes('docs-checks'));
    const commands = commandsOf('docs-checks');
    assert.match(commands, /traceability:check/);
    assert.match(commands, /pnpm doc-check/);
    assert.match(commands, /pnpm test:docs/);
  });

  it('AC-08.8 the CI tooling tests of the gate do not include the document checks', () => {
    assert.match(pkg.scripts['test:tools'], /tools\/ci\//);
    assert.doesNotMatch(pkg.scripts['test:tools'], /docs-checks/);
    assert.match(pkg.scripts['test:docs'], /tools\/docs-checks\//);
  });
});
