import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';
import {
  checkTraceability,
  expandCovers,
  loadModel,
  parseBrief,
  validateWaivers,
  renderMatrix,
  renderTestReport,
  scanTests,
  scanTestsAt,
} from './traceability.mjs';

const dirs = [];

const SPEC = `# Spec 099
### US-99.1 — Sign up (\`MUST\`)

**Acceptance criteria**

- **AC-99.1.1** First.
- **AC-99.1.2** Second.
- **AC-99.1.3** Third.

### US-99.2 — Sign in (\`COULD\`)

- **AC-99.2.1** Only.
`;

const FEATURE = `Feature: Auth
  Rule: People can sign up
    @US-99.1 @AC-99.1.1 @must @api
    Scenario: Sign up works
      Given x

    @US-99.1 @AC-99.1.2 @AC-99.1.3 @must @concurrency
    Scenario Outline: Boundaries
      Given <x>

  Rule: People can sign in
    @US-99.2 @AC-99.2.1 @could @api
    Scenario: Sign in works
      Given x
`;

const TASKS = `# Tasks
## T-099-01 — First task
- **Covers:** @AC-99.1.1 – @AC-99.1.3
## T-099-02 — Second task
- **Covers:** @AC-99.2.1
`;

/** Builds a repo-like tree (docs/specs/...) and returns its root. */
function repo(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'trace-'));
  dirs.push(root);
  const all = {
    'docs/specs/099-auth/spec.md': SPEC,
    'docs/specs/099-auth/auth.feature': FEATURE,
    'docs/specs/099-auth/tasks.md': TASKS,
    ...files,
  };
  for (const [path, text] of Object.entries(all)) {
    if (text === null) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const check = (root, tests = new Map()) =>
  checkTraceability(loadModel(root), tests);
const messages = (result) => result.failures.join('\n');

describe('traceability model', () => {
  after(() =>
    dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
  );

  it('AC-07.6.5 parses stories, acceptance criteria, scenarios and task coverage', () => {
    const model = loadModel(repo());
    assert.equal(model.stories.size, 2);
    assert.equal(model.acs.size, 4);
    assert.equal(model.scenarios.length, 3);
    assert.deepEqual([...model.acTasks.get('AC-99.1.2')], ['T-099-01']);
  });

  it('AC-07.6.5 expands Covers ranges with en dashes, em dashes and hyphens', () => {
    for (const dash of ['–', '—', '-']) {
      const ids = expandCovers(
        `- **Covers:** @AC-99.1.1 ${dash} @AC-99.1.3, @AC-99.2.1`,
      );
      assert.deepEqual([...ids].sort(), [
        'AC-99.1.1',
        'AC-99.1.2',
        'AC-99.1.3',
        'AC-99.2.1',
      ]);
    }
  });

  it('AC-07.6.5 a consistent tree has no failures', () => {
    assert.deepEqual(check(repo()).failures, []);
  });

  it('AC-07.6.5 fails when a MUST AC has no scenario', () => {
    const feature = FEATURE.replace('@AC-99.1.1 ', '');
    const result = check(repo({ 'docs/specs/099-auth/auth.feature': feature }));
    assert.match(messages(result), /AC-99\.1\.1.*MUST.*no scenario/);
  });

  it('AC-07.6.5 fails when a MUST AC is in no task Covers line', () => {
    const tasks = TASKS.replace('@AC-99.1.3', '@AC-99.1.2');
    const result = check(repo({ 'docs/specs/099-auth/tasks.md': tasks }));
    assert.match(messages(result), /AC-99\.1\.3.*MUST.*no task/);
  });

  it('AC-07.6.5 only warns about COULD ACs without a task or scenario', () => {
    const tasks = TASKS.replace(
      '- **Covers:** @AC-99.2.1',
      '- **Covers:** none',
    );
    const result = check(repo({ 'docs/specs/099-auth/tasks.md': tasks }));
    assert.deepEqual(result.failures, []);
    assert.ok(result.warnings.some((w) => w.includes('AC-99.2.1')));
  });

  it('AC-07.6.5 fails when a scenario priority differs from its story', () => {
    const feature = FEATURE.replace('@AC-99.1.1 @must', '@AC-99.1.1 @should');
    const result = check(repo({ 'docs/specs/099-auth/auth.feature': feature }));
    assert.match(messages(result), /Sign up works.*@should.*MUST/);
  });

  it('AC-07.6.5 fails when a scenario or a Covers line names an AC that is not in a spec', () => {
    const feature = FEATURE.replace('@AC-99.2.1', '@AC-99.2.9');
    const tasks = TASKS + '- **Covers:** @AC-09.9.9\n';
    const result = check(
      repo({
        'docs/specs/099-auth/auth.feature': feature,
        'docs/specs/099-auth/tasks.md': tasks,
      }),
    );
    assert.match(messages(result), /AC-99\.2\.9/);
  });

  it('AC-07.6.5 finds AC ids at the start of test titles, including it.each tables', () => {
    const root = repo({
      'apps/api/src/a.spec.ts':
        "it('AC-99.1.1 signs up', () => {});\nit.each([[1]])('AC-99.1.2 and AC-99.1.3 boundaries %s', () => {});\nit('not an AC title', () => {});\n",
      'apps/api/test/b.int-spec.ts': 'describe("AC-99.2.1 sign-in", () => {});',
      'tools/ci/c.test.mjs': "it('AC-99.1.1 also here', () => {});",
      'node_modules/x/d.spec.ts': "it('AC-99.1.1 ignored', () => {});",
    });
    const tests = scanTests(root);
    assert.deepEqual([...tests.get('AC-99.1.1')].sort(), [
      'apps/api/src/a.spec.ts',
      'tools/ci/c.test.mjs',
    ]);
    assert.deepEqual([...tests.get('AC-99.1.3')], ['apps/api/src/a.spec.ts']);
    assert.deepEqual(
      [...tests.get('AC-99.2.1')],
      ['apps/api/test/b.int-spec.ts'],
    );
  });

  it('AC-07.6.5 ignores AC titles inside // and /* */ comments but not URLs in strings', () => {
    const root = repo({
      'apps/api/src/a.spec.ts': [
        "// it('AC-99.1.1 commented out', () => {});",
        "/* it('AC-99.1.2 block comment', () => {}); */",
        '/**',
        " * it('AC-99.1.3 doc comment', () => {});",
        ' */',
        "const url = 'http://example.com'; it('AC-99.2.1 real test after a url', () => {});",
      ].join('\n'),
    });
    const tests = scanTests(root);
    assert.equal(tests.has('AC-99.1.1'), false);
    assert.equal(tests.has('AC-99.1.2'), false);
    assert.equal(tests.has('AC-99.1.3'), false);
    assert.deepEqual([...tests.get('AC-99.2.1')], ['apps/api/src/a.spec.ts']);
  });

  it('AC-07.6.5 counts an AC id only when it is the title of an it, test or describe call', () => {
    const root = repo({
      'apps/api/src/a.spec.ts': [
        "const label = 'AC-99.1.1 only a label';",
        "const cases = ['AC-99.1.2 in an array'];",
        "expect(title).toBe('AC-99.1.3 in an assertion');",
        "it('AC-99.2.1 a real title', () => {});",
        "describe('AC-99.2.2 a real suite', () => {});",
        "it.only('AC-99.2.3 only', () => {});",
        "it.each([['a', fn(1)], ['b', fn(2)]])('AC-99.2.4 table %s', () => {});",
        "test.concurrent('AC-99.2.5 concurrent', async () => {});",
      ].join('\n'),
    });
    const tests = scanTests(root);
    for (const id of ['AC-99.1.1', 'AC-99.1.2', 'AC-99.1.3']) {
      assert.equal(tests.has(id), false, `${id} is not a test title`);
    }
    for (const id of [
      'AC-99.2.1',
      'AC-99.2.2',
      'AC-99.2.3',
      'AC-99.2.4',
      'AC-99.2.5',
    ]) {
      assert.ok(tests.has(id), `${id} is a test title`);
    }
  });

  it('AC-07.6.5 ignores titles nested inside describe.skip and xdescribe blocks', () => {
    const root = repo({
      'apps/api/src/a.spec.ts': [
        "describe.skip('suite', () => {",
        "  it('AC-99.1.1 nested in a skipped suite', () => {});",
        "  describe('inner', () => { it('AC-99.1.2 deeper', () => {}); });",
        '});',
        "xdescribe('suite', () => {",
        "  it('AC-99.1.3 nested in xdescribe', () => {});",
        '});',
        "describe('live suite', () => {",
        "  it('AC-99.2.1 still counts', () => {});",
        '});',
      ].join('\n'),
    });
    const tests = scanTests(root);
    for (const id of ['AC-99.1.1', 'AC-99.1.2', 'AC-99.1.3'])
      assert.equal(tests.has(id), false, id);
    assert.ok(tests.has('AC-99.2.1'));
  });

  it('AC-07.6.5 a quote inside a regex literal does not swallow the next test title', () => {
    const root = repo({
      'apps/api/src/a.spec.ts': [
        'const quote = /"/;',
        "const apostrophe = /'[a-z]+/g;",
        "const text = 'it' + `x`;",
        "it('AC-99.2.1 after a regex with a double quote', () => {});",
        "it('AC-99.2.2 after a regex with an apostrophe', () => {});",
        'const half = total / 2; // a division, not a regex',
        "it('AC-99.2.3 after a division', () => {});",
      ].join('\n'),
    });
    const tests = scanTests(root);
    for (const id of ['AC-99.2.1', 'AC-99.2.2', 'AC-99.2.3'])
      assert.ok(tests.has(id), id);
  });

  it('AC-07.6.5 waivers must be a list of {ac, reason} with a reason; stale waivers warn', () => {
    assert.deepEqual(
      validateWaivers([{ ac: 'AC-99.1.1', reason: 'moved to the mobile app' }]),
      [],
    );
    for (const bad of [
      {},
      [{ ac: 'AC-99.1.1' }],
      [{ ac: 'AC-99.1.1', reason: '  ' }],
      [{ ac: 'nope', reason: 'x' }],
      [{ reason: 'x' }],
      ['AC-99.1.1'],
    ]) {
      assert.ok(validateWaivers(bad).length > 0, JSON.stringify(bad));
    }
    const model = loadModel(repo());
    const result = checkTraceability(model, new Map(), {
      baseTests: new Map(),
      waivers: [{ ac: 'AC-99.1.1', reason: 'old' }],
    });
    assert.deepEqual(result.failures, []);
    assert.ok(
      result.warnings.some(
        (w) => w.includes('AC-99.1.1') && w.includes('stale'),
      ),
    );
    const invalid = checkTraceability(model, new Map(), {
      waivers: [{ ac: 'AC-99.1.1' }],
    });
    assert.match(messages(invalid), /waiver/);
  });

  it('AC-07.6.5 ignores skipped, todo, failing and x-prefixed tests', () => {
    const root = repo({
      'apps/api/src/a.spec.ts': [
        "it.skip('AC-99.1.1 skipped', () => {});",
        "test.skip('AC-99.1.2 skipped', () => {});",
        "describe.skip('AC-99.1.3 skipped', () => {});",
        "it.todo('AC-99.2.1 todo');",
        "test.todo('AC-99.2.2 todo');",
        "xit('AC-99.2.3 x', () => {});",
        "xdescribe('AC-99.2.4 x', () => {});",
        "xtest('AC-99.2.5 x', () => {});",
        "it.failing('AC-99.2.6 failing', () => {});",
        "it.skip.each([[1]])('AC-99.2.7 skipped table', () => {});",
        "it('AC-99.3.1 runs', () => {});",
      ].join('\n'),
    });
    const tests = scanTests(root);
    for (const id of [
      'AC-99.1.1',
      'AC-99.1.2',
      'AC-99.1.3',
      'AC-99.2.1',
      'AC-99.2.2',
      'AC-99.2.3',
      'AC-99.2.4',
      'AC-99.2.5',
      'AC-99.2.6',
      'AC-99.2.7',
    ]) {
      assert.equal(tests.has(id), false, `${id} must not count`);
    }
    assert.ok(tests.has('AC-99.3.1'));
  });

  it('AC-07.6.5 reads the Status line of each task', () => {
    const tasks = TASKS.replace(
      '## T-099-01 — First task\n',
      '## T-099-01 — First task\n- **Status:** done\n',
    );
    const model = loadModel(repo({ 'docs/specs/099-auth/tasks.md': tasks }));
    assert.equal(model.taskStatus.get('T-099-01'), 'done');
    assert.equal(model.taskStatus.get('T-099-02'), undefined);
  });

  it('AC-07.6.5 keeps split tasks (letter suffix) apart, with their own Covers and Status', () => {
    const model = loadModel(
      repo({
        'docs/specs/099-auth/tasks.md': [
          '# Tasks',
          '## T-099-01 — First task',
          '- **Covers:** @AC-99.1.1',
          '## T-099-02a — Query side',
          '- **Status:** done',
          '- **Covers:** @AC-99.1.2',
          '## T-099-02b — Endpoint',
          '- **Covers:** @AC-99.1.3 @AC-99.2.1',
          '',
        ].join('\n'),
      }),
    );
    assert.deepEqual([...model.acTasks.get('AC-99.1.1')], ['T-099-01']);
    assert.deepEqual([...model.acTasks.get('AC-99.1.2')], ['T-099-02a']);
    assert.deepEqual([...model.acTasks.get('AC-99.1.3')], ['T-099-02b']);
    assert.equal(model.taskStatus.get('T-099-02a'), 'done');
    assert.equal(model.taskStatus.get('T-099-01'), undefined);
    assert.equal(model.taskStatus.get('T-099-02b'), undefined);
  });

  it('AC-07.6.5 never attributes lines under an unrecognised heading to the previous task', () => {
    const model = loadModel(
      repo({
        'docs/specs/099-auth/tasks.md': [
          '# Tasks',
          '## T-099-01 — First task',
          '- **Covers:** @AC-99.1.1 – @AC-99.1.3',
          '## T-099-XX — Malformed id',
          '- **Status:** done',
          '- **Covers:** @AC-99.2.1',
          '',
        ].join('\n'),
      }),
    );
    assert.equal(model.taskStatus.get('T-099-01'), undefined);
    assert.equal(model.acTasks.get('AC-99.2.1'), undefined);
  });

  describe('task Status values fail closed', () => {
    const withStatus = (value) =>
      loadModel(
        repo({
          'docs/specs/099-auth/tasks.md': TASKS.replace(
            '## T-099-01 — First task\n',
            `## T-099-01 — First task\n- **Status:** ${value}\n`,
          ),
        }),
      );

    it('AC-07.6.5 accepts todo, in-progress and done in any case', () => {
      for (const value of ['todo', 'in-progress', 'done', 'Done', 'DONE']) {
        const model = withStatus(value);
        assert.deepEqual(
          checkTraceability(model, new Map()).failures,
          [],
          value,
        );
      }
      assert.equal(withStatus('Done').taskStatus.get('T-099-01'), 'done');
    });

    it('AC-07.6.5 fails an unknown value naming the task, instead of treating the task as not done', () => {
      for (const value of ['finished', 'done.', 'done (merged)', 'wip', '']) {
        const result = checkTraceability(withStatus(value), new Map());
        assert.match(messages(result), /T-099-01.*Status/, `'${value}'`);
        assert.match(messages(result), /todo, in-progress or done/);
      }
    });

    it('AC-07.6.5 an unknown Status never silently counts as not done under --require-tests', () => {
      const result = checkTraceability(withStatus('done.'), new Map(), {
        requireTests: true,
      });
      assert.match(messages(result), /T-099-01/);
    });
  });

  describe('stale waivers', () => {
    const lostBase = new Map([
      ['AC-99.1.1', new Set(['apps/api/src/a.spec.ts'])],
    ]);

    it('AC-07.6.5 a waiver whose AC now has a test is reported stale', () => {
      const model = loadModel(repo());
      const head = new Map([
        ['AC-99.1.1', new Set(['apps/api/src/b.spec.ts'])],
      ]);
      const result = checkTraceability(model, head, {
        baseTests: lostBase,
        waivers: [{ ac: 'AC-99.1.1', reason: 'moved' }],
      });
      assert.ok(
        result.warnings.some(
          (w) => w.includes('AC-99.1.1') && w.includes('stale'),
        ),
      );
    });

    it('AC-07.6.5 stale waivers are not reported when there is no pull request base to compare with', () => {
      const model = loadModel(repo());
      const result = checkTraceability(model, new Map(), {
        baseTests: new Map(),
        reportStaleWaivers: false,
        waivers: [{ ac: 'AC-99.1.1', reason: 'moved' }],
      });
      assert.deepEqual(
        result.warnings.filter((w) => w.includes('stale')),
        [],
      );
    });
  });

  describe('--require-tests', () => {
    const done = (ids) =>
      ids.reduce(
        (text, id) =>
          text
            .replace(`## ${id} —`, `## ${id} —`)
            .replace(
              new RegExp(`(## ${id} — .*\\n)`),
              '$1- **Status:** done\n',
            ),
        TASKS,
      );
    const strict = (tasksText, tests = new Map(), extra = {}) =>
      checkTraceability(
        loadModel(repo({ 'docs/specs/099-auth/tasks.md': tasksText })),
        tests,
        {
          requireTests: true,
          ...extra,
        },
      );

    it('AC-07.6.5 fails a MUST AC covered only by done tasks that has no test, naming the AC and the task', () => {
      const result = strict(done(['T-099-01']));
      assert.match(
        messages(result),
        /AC-99\.1\.1.*T-099-01.*no automated test/,
      );
      assert.match(messages(result), /AC-99\.1\.3/);
    });

    it('AC-07.6.5 passes when the done task has a test for each of its MUST ACs', () => {
      const tests = new Map(
        ['AC-99.1.1', 'AC-99.1.2', 'AC-99.1.3'].map((ac) => [
          ac,
          new Set(['apps/api/src/a.spec.ts']),
        ]),
      );
      assert.deepEqual(strict(done(['T-099-01']), tests).failures, []);
    });

    it('AC-07.6.5 does not fail an open task', () => {
      assert.deepEqual(strict(TASKS).failures, []);
    });

    it('AC-07.6.5 does not fail while another task covering the AC is still open', () => {
      const tasks =
        done(['T-099-01']) +
        '## T-099-03 — Third task\n- **Covers:** @AC-99.1.1\n';
      const result = strict(tasks);
      assert.ok(!/AC-99\.1\.1\b/.test(messages(result)), messages(result));
      assert.match(messages(result), /AC-99\.1\.2/);
    });

    it('AC-07.6.5 only enforces MUST ACs', () => {
      const result = strict(done(['T-099-01', 'T-099-02']));
      assert.ok(!/AC-99\.2\.1/.test(messages(result)));
    });

    it('AC-07.6.5 a waiver downgrades the failure to a warning', () => {
      const result = strict(done(['T-099-01']), new Map(), {
        waivers: ['AC-99.1.1', 'AC-99.1.2', 'AC-99.1.3'].map((ac) => ({
          ac,
          reason: 'manual check',
        })),
      });
      assert.deepEqual(result.failures, []);
      assert.ok(
        result.warnings.some(
          (w) => w.includes('AC-99.1.1') && w.includes('waived'),
        ),
      );
    });

    it('AC-07.6.5 a waiver that downgrades a missing test is not reported as stale', () => {
      const result = strict(done(['T-099-01']), new Map(), {
        baseTests: new Map(),
        waivers: [{ ac: 'AC-99.1.1', reason: 'manual check' }],
      });
      assert.ok(
        !result.warnings.some((w) => w.includes('stale')),
        result.warnings.join('\n'),
      );
    });

    it('AC-07.6.5 is off by default', () => {
      const model = loadModel(
        repo({ 'docs/specs/099-auth/tasks.md': done(['T-099-01']) }),
      );
      assert.deepEqual(checkTraceability(model, new Map()).failures, []);
    });
  });

  it('AC-07.6.5 the job summary counts ACs with tests and lists MUST ACs without one', () => {
    const model = loadModel(repo());
    const tests = new Map([['AC-99.1.1', new Set(['apps/api/src/a.spec.ts'])]]);
    const report = renderTestReport(model, tests);
    assert.match(report, /\| MUST \| 1 \/ 3 \|/);
    assert.match(
      report,
      /### MUST acceptance criteria without an automated test \(2\)/,
    );
    assert.match(report, /US-99\.1: AC-99\.1\.2, AC-99\.1\.3/);
    assert.deepEqual(checkTraceability(model, tests).failures, []);
  });

  it('AC-07.6.5 the brief section says its ids follow the README row order', () => {
    assert.match(
      renderMatrix(loadModel(repo()), []),
      /follow the row order of the brief traceability table/,
    );
  });

  it('AC-07.6.5 the committed matrix is structural: no test data, so parallel PRs do not conflict', () => {
    const root = repo({
      'apps/api/src/a.spec.ts': "it('AC-99.1.1 signs up', () => {});",
    });
    const model = loadModel(root);
    const matrix = renderMatrix(model, []);
    assert.ok(!matrix.includes('a.spec.ts'));
    assert.ok(!/with test|\| Tests \|/.test(matrix));
    assert.equal(renderMatrix(model, []), matrix);
  });

  it('AC-07.6.5 an AC that had a test on the base and has none on the head fails', () => {
    const model = loadModel(repo());
    const baseTests = new Map([
      ['AC-99.1.1', new Set(['apps/api/src/a.spec.ts'])],
    ]);
    const result = checkTraceability(model, new Map(), { baseTests });
    assert.match(messages(result), /AC-99\.1\.1.*lost its last test/);
  });

  it('AC-07.6.5 an AC that keeps a test, or never had one, does not fail the comparison', () => {
    const model = loadModel(repo());
    const head = new Map([['AC-99.1.1', new Set(['apps/api/src/b.spec.ts'])]]);
    const baseTests = new Map([
      ['AC-99.1.1', new Set(['apps/api/src/a.spec.ts'])],
    ]);
    assert.deepEqual(
      checkTraceability(model, head, { baseTests }).failures,
      [],
    );
    assert.deepEqual(
      checkTraceability(model, new Map(), { baseTests: new Map() }).failures,
      [],
    );
  });

  it('AC-07.6.5 a recorded waiver turns the lost test into a warning', () => {
    const model = loadModel(repo());
    const baseTests = new Map([
      ['AC-99.1.1', new Set(['apps/api/src/a.spec.ts'])],
    ]);
    const result = checkTraceability(model, new Map(), {
      baseTests,
      waivers: [{ ac: 'AC-99.1.1', reason: 'moved to the mobile app' }],
    });
    assert.deepEqual(result.failures, []);
    assert.ok(
      result.warnings.some(
        (w) => w.includes('AC-99.1.1') && w.includes('waived'),
      ),
    );
  });

  it('AC-07.6.5 compares against the tests committed at a git ref', async () => {
    const { execFileSync } = await import('node:child_process');
    const root = repo({
      'apps/api/src/a.spec.ts': "it('AC-99.1.1 signs up', () => {});",
    });
    const git = (...args) =>
      execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '-q');
    git('add', '-A');
    git(
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      'commit',
      '-q',
      '-m',
      'base',
    );
    const base = git('rev-parse', 'HEAD').trim();
    writeFileSync(
      join(root, 'apps/api/src/a.spec.ts'),
      "it.skip('AC-99.1.1 signs up', () => {});",
    );
    const baseTests = scanTestsAt(root, base);
    assert.deepEqual(
      [...baseTests.get('AC-99.1.1')],
      ['apps/api/src/a.spec.ts'],
    );
    const result = checkTraceability(loadModel(root), scanTests(root), {
      baseTests,
    });
    assert.match(messages(result), /AC-99\.1\.1.*lost its last test/);
  });

  it('AC-07.6.5 a stale committed matrix fails with a diff', () => {
    const model = loadModel(repo());
    const fresh = renderMatrix(model, []);
    const stale = fresh.replace('Sign up works', 'Sign up worked');
    const result = checkTraceability(model, new Map(), {
      committed: stale,
      generated: fresh,
    });
    assert.match(messages(result), /out of date/);
    assert.match(messages(result), /Sign up worked|Sign up works/);
  });
});

describe('brief requirement parsing', () => {
  const brief = `# Traceability (English)

| Brief requirement | Level | Epic → stories (spec) |
| --- | --- | --- |
| Team CRUD | MUST | EP-02: US-02.1, 02.5, 02.6; UI US-04.3 |
| Task listing | MUST | EP-03: US-03.2–03.4; UI US-04.5 |
| Stories by range | MUST | EP-04 (US-04.2–04.4) |
| Docs | MUST | EP-07: US-07.4 (AC-07.4.5–07.4.7); EP-06: US-06.8 |
| Slash list | MUST | EP-03: US-03.2/03.8 (embedded teams) |
| Not done | Not pursued | Out of scope by decision |
| Mock-up | — | Not used |
`;

  it('AC-07.6.5 resolves ids, bare numbers, ranges and AC ranges per row', () => {
    const rows = parseBrief(brief);
    assert.equal(rows.length, 7);
    assert.deepEqual(rows[0].stories, [
      'US-02.1',
      'US-02.5',
      'US-02.6',
      'US-04.3',
    ]);
    assert.deepEqual(rows[1].stories, [
      'US-03.2',
      'US-03.3',
      'US-03.4',
      'US-04.5',
    ]);
    assert.deepEqual(rows[2].stories, ['US-04.2', 'US-04.3', 'US-04.4']);
    assert.deepEqual(rows[3].stories, ['US-07.4', 'US-06.8']);
    assert.deepEqual(rows[3].acs, ['AC-07.4.5', 'AC-07.4.6', 'AC-07.4.7']);
    assert.deepEqual(rows[4].stories, ['US-03.2', 'US-03.8']);
  });

  it('AC-07.6.5 rows are numbered in README order and rows that are not pursued are kept out of the coverage', () => {
    const rows = parseBrief(brief);
    assert.deepEqual(
      rows.map((r) => r.id),
      ['B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7'],
    );
    assert.deepEqual(
      rows.filter((r) => r.counted).map((r) => r.id),
      ['B-1', 'B-2', 'B-3', 'B-4', 'B-5'],
    );
  });
});

describe('traceability command line', () => {
  const script = fileURLToPath(new URL('./traceability.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('../../', import.meta.url));
  const run = (env) =>
    spawnSync(process.execPath, [script], {
      cwd,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
    });

  it('AC-07.6.5 fails closed when BASE_SHA is set but cannot be scanned', () => {
    const result = run({ BASE_SHA: 'deadbeef' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /base.*deadbeef|deadbeef.*base/i);
  });

  it('AC-07.6.5 fails closed on a pull_request event without a base sha', () => {
    const result = run({ GITHUB_EVENT_NAME: 'pull_request' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /base/i);
  });
});
