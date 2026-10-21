// Requirement traceability gate (T-007-06, AC-07.6.5). Parses docs/specs/*/{spec.md,*.feature,
// tasks.md}, the brief traceability table and the AC ids in test titles, regenerates the structural
// docs/quality/traceability-matrix.md and fails on gaps or drift.
//   node tools/ci/traceability.mjs                  check (CI): gaps, stale matrix, lost tests
//   node tools/ci/traceability.mjs --write          regenerate the matrix, then check
//   node tools/ci/traceability.mjs --base <ref>     compare tests with <ref> (default: $BASE_SHA,
//                                                   else the merge-base with origin/main)
// The matrix holds no test data (parallel PRs would conflict on it). Which ACs have tests is computed
// on every run and written to the CI job summary; an AC that had a test at the base and has none
// now fails unless tools/ci/traceability-waivers.json records why. Ported from the QA generator.
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const MATRIX = 'docs/quality/traceability-matrix.md';
const WAIVERS = 'tools/ci/traceability-waivers.json';
const PRIORITIES = ['must', 'should', 'could'];
const KINDS = [
  'api',
  'mobile',
  'docs',
  'ops',
  'security',
  'concurrency',
  'idempotency',
];
const MAESTRO_STORIES = new Set([
  'US-04.1',
  'US-04.2',
  'US-04.4',
  'US-04.5',
  'US-04.6',
  'US-04.7',
  'US-04.9',
  'US-05.2',
  'US-05.3',
  'US-05.6',
]);
const DASHES = /[–—]/g;

const numeric = (id) =>
  id
    .replace(/^[A-Z-]+/, '')
    .split('.')
    .map(Number);
const byNumber = (a, b) => {
  const [x, y] = [numeric(a), numeric(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
};

/** AC ids named on a `Covers:` line, with `@AC-a – @AC-b` ranges expanded. */
export function expandCovers(line) {
  const out = new Set();
  const text = line.replace(DASHES, '-');
  for (const m of text.matchAll(
    /@?(AC-\d\d\.\d+)\.(\d+)\s*-\s*@?AC-\d\d\.\d+\.(\d+)/g,
  )) {
    for (let k = Number(m[2]); k <= Number(m[3]); k += 1)
      out.add(`${m[1]}.${k}`);
  }
  for (const m of text.matchAll(/@?(AC-\d\d\.\d+\.\d+)/g)) out.add(m[1]);
  return out;
}

const read = (path) => readFileSync(path, 'utf8');
const listDir = (dir) => (existsSync(dir) ? readdirSync(dir).sort() : []);

/** Everything the gate knows about the specs. */
export function loadModel(root) {
  const specsDir = join(root, 'docs/specs');
  const specs = listDir(specsDir).filter((name) => /^0/.test(name));
  const stories = new Map();
  const acs = new Map();
  const scenarios = [];
  const tasks = new Map();
  const taskTitle = new Map();
  const acTasks = new Map();
  const acScen = new Map();

  for (const spec of specs) {
    const dir = join(specsDir, spec);
    const specText = existsSync(join(dir, 'spec.md'))
      ? read(join(dir, 'spec.md'))
      : '';
    for (const m of specText.matchAll(
      /^### (US-\d\d\.\d+) — (.*?) \(`(MUST|SHOULD|COULD)`/gm,
    )) {
      stories.set(m[1], { title: m[2], prio: m[3].toLowerCase(), spec });
    }
    for (const m of specText.matchAll(/\*\*(AC-\d\d\.\d+\.\d+)\*\*/g)) {
      if (!acs.has(m[1]))
        acs.set(m[1], {
          story: `US-${m[1].slice(3).replace(/\.\d+$/, '')}`,
          spec,
        });
    }
  }

  for (const spec of specs) {
    const dir = join(specsDir, spec);
    for (const file of listDir(dir).filter((name) =>
      name.endsWith('.feature'),
    )) {
      const lines = read(join(dir, file)).split('\n');
      let rule = '';
      lines.forEach((line, index) => {
        const ruleMatch = /^\s*Rule: (.*)/.exec(line);
        if (ruleMatch) rule = ruleMatch[1];
        const match = /^\s*Scenario(?: Outline)?: (.*)/.exec(line);
        if (!match) return;
        let j = index - 1;
        while (j > 0 && !lines[j].trim().startsWith('@')) j -= 1;
        const tags = lines[j].trim().split(/\s+/);
        scenarios.push({
          file: `${spec}/${file}`,
          rule,
          name: match[1],
          us: tags.filter((t) => t.startsWith('@US-')).map((t) => t.slice(1)),
          acs: tags.filter((t) => t.startsWith('@AC-')).map((t) => t.slice(1)),
          prio: tags
            .filter((t) => PRIORITIES.includes(t.slice(1)))
            .map((t) => t.slice(1)),
          kind: tags
            .filter((t) => KINDS.includes(t.slice(1)))
            .map((t) => t.slice(1)),
          outline: line.includes('Outline'),
        });
      });
    }
  }

  for (const spec of specs) {
    const file = join(specsDir, spec, 'tasks.md');
    if (!existsSync(file)) continue;
    let current = null;
    for (const line of read(file).split('\n')) {
      const header = /^## (T-\d+-\d+) — (.*)/.exec(line);
      if (header) {
        current = header[1];
        taskTitle.set(current, header[2].trim());
        tasks.set(current, new Set());
        continue;
      }
      if (current && line.startsWith('- **Covers:**')) {
        for (const ac of expandCovers(line)) {
          tasks.get(current).add(ac);
          if (!acTasks.has(ac)) acTasks.set(ac, new Set());
          acTasks.get(ac).add(current);
        }
      }
      if (line.startsWith('## ') && !line.startsWith('## T-')) current = null;
    }
  }

  for (const scenario of scenarios) {
    for (const ac of scenario.acs) {
      if (!acScen.has(ac)) acScen.set(ac, []);
      acScen.get(ac).push(scenario);
    }
  }
  return {
    root,
    specs,
    stories,
    acs,
    scenarios,
    tasks,
    taskTitle,
    acTasks,
    acScen,
  };
}

const IS_TEST_FILE =
  /\.(spec|int-spec|e2e-spec)\.(ts|tsx)$|\.test\.(mjs|ts|tsx|js)$/;
const SKIPPED_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.turbo',
  '.git',
  'generated',
  'docs',
]);

/** True when a `/` at this point of the output starts a regex literal rather than a division. */
function startsRegex(out) {
  const previous = out.trimEnd();
  if (!previous) return true;
  return (
    /[(,=:[!&|?{};+\-*%<>~^]$/.test(previous) ||
    /\b(?:return|typeof|case|void|delete|in|of)$/.test(previous)
  );
}

/** Source without // and /* *\/ comments; string, template and regex literals are left untouched. */
export function stripComments(source) {
  let out = '';
  for (let i = 0; i < source.length;) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
    } else if (c === '/' && next === '*') {
      i += 2;
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === '/')
      ) {
        if (source[i] === '\n') out += '\n';
        i += 1;
      }
      i += 2;
    } else if (c === '/' && startsRegex(out)) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== '\n') {
        if (source[j] === '\\') j += 2;
        else {
          if (source[j] === '[') inClass = true;
          else if (source[j] === ']') inClass = false;
          else if (source[j] === '/' && !inClass) break;
          j += 1;
        }
      }
      if (source[j] === '/') {
        j += 1;
        while (/[a-z]/i.test(source[j] ?? '')) j += 1;
        out += source.slice(i, j);
        i = j;
      } else {
        out += c;
        i += 1;
      }
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== c)
        j += source[j] === '\\' ? 2 : 1;
      out += source.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/** Index of the parenthesis that closes the one at `open` (strings and templates are skipped). */
function closingParen(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    const c = code[i];
    if (c === "'" || c === '"' || c === '`') {
      i += 1;
      while (i < code.length && code[i] !== c) i += code[i] === '\\' ? 2 : 1;
    } else if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return code.length;
}

/**
 * AC ids that start a live test title: `it('AC-01.1.1 …')`, describe, it.each tables. Comments and
 * skipped tests (skip, todo, failing, xit, xdescribe, xtest) do not count.
 */
export function testIdsFromSource(source) {
  const code = stripComments(source);
  const args = String.raw`(?:\((?:[^()]|\([^()]*\))*\))`;
  const skippedSuites = [];
  for (const m of code.matchAll(
    new RegExp(
      String.raw`\b(?:xdescribe|describe\.(?:skip|todo))(?:\.\w+${args}?)*\s*\(`,
      'g',
    ),
  )) {
    const open = m.index + m[0].length - 1;
    skippedSuites.push([open, closingParen(code, open)]);
  }
  const callee = new RegExp(
    String.raw`\b(x?(?:it|test|describe))((?:\.\w+${args}?)*)\s*\(\s*$`,
  );
  const ids = new Set();
  for (const m of code.matchAll(/(['"`])(AC-\d\d\.\d+\.\d+(?:(?!\1).)*)\1/g)) {
    const found = callee.exec(code.slice(Math.max(0, m.index - 400), m.index));
    // Only the title of an it/test/describe call counts, and only when the call is not skipped.
    if (!found) continue;
    if (/^x/.test(found[1]) || /\.(?:skip|todo|failing)\b/.test(found[2]))
      continue;
    if (skippedSuites.some(([from, to]) => m.index > from && m.index < to))
      continue;
    for (const id of m[2].matchAll(/AC-\d\d\.\d+\.\d+/g)) ids.add(id[0]);
  }
  return ids;
}

function addTests(tests, file, source) {
  for (const id of testIdsFromSource(source)) {
    if (!tests.has(id)) tests.set(id, new Set());
    tests.get(id).add(file);
  }
}

/** AC id -> test files of the working tree. */
export function scanTests(root) {
  const tests = new Map();
  const visit = (dir) => {
    for (const name of listDir(dir)) {
      if (SKIPPED_DIRS.has(name) || name.startsWith('.')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) visit(path);
      else if (IS_TEST_FILE.test(name))
        addTests(tests, relative(root, path).split('\\').join('/'), read(path));
    }
  };
  for (const top of ['apps', 'packages', 'tools']) visit(join(root, top));
  return tests;
}

/** AC id -> test files as committed at a git ref (no checkout needed). */
export function scanTestsAt(root, ref) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
  const tests = new Map();
  const files = git(
    'ls-tree',
    '-r',
    '--name-only',
    ref,
    '--',
    'apps',
    'packages',
    'tools',
  )
    .split('\n')
    .filter(Boolean)
    .filter((file) => {
      const parts = file.split('/');
      return (
        IS_TEST_FILE.test(parts.at(-1)) &&
        !parts.some((part) => SKIPPED_DIRS.has(part) || part.startsWith('.'))
      );
    });
  for (const file of files)
    addTests(tests, file, git('show', `${ref}:${file}`));
  return tests;
}

/** Brief requirement rows from the "Traceability (English)" table of docs/brief/README.md. */
export function parseBrief(markdown) {
  const start = markdown.indexOf('# Traceability (English)');
  const rows = [];
  if (start === -1) return rows;
  for (const line of markdown.slice(start).split('\n')) {
    if (
      !line.startsWith('|') ||
      /^\|\s*-/.test(line) ||
      /^\|\s*Brief requirement/.test(line)
    )
      continue;
    const [requirement, level, cell] = line
      .split('|')
      .slice(1, 4)
      .map((part) => part.trim());
    const stories = [];
    const acs = [];
    const token =
      /AC-(\d\d)\.(\d+)\.(\d+)(?:\s*[–—-]\s*(?:AC-)?(?:\d\d\.\d+\.)?(\d+))?|US-(\d\d)\.(\d+)(?:\s*[–—-]\s*(?:US-)?(?:\d\d\.)?(\d+))?|(?<![\w.-])(\d\d)\.(\d+)(?![\d.])(?:\s*[–—-]\s*(?:\d\d\.)?(\d+)(?![\d.]))?/g;
    for (const m of cell.matchAll(token)) {
      if (m[1]) {
        for (let k = Number(m[3]); k <= Number(m[4] ?? m[3]); k += 1)
          acs.push(`AC-${m[1]}.${m[2]}.${k}`);
      } else {
        const [epic, from, to] = m[5]
          ? [m[5], m[6], m[7]]
          : [m[8], m[9], m[10]];
        for (let k = Number(from); k <= Number(to ?? from); k += 1)
          stories.push(`US-${epic}.${k}`);
      }
    }
    rows.push({
      id: `B-${rows.length + 1}`,
      requirement,
      level,
      stories: [...new Set(stories)],
      acs: [...new Set(acs)],
      counted: level === 'MUST' || level === 'SHOULD',
    });
  }
  return rows;
}

const priorityOf = (model, ac) =>
  model.stories.get(model.acs.get(ac)?.story)?.prio ?? '?';

/** Gaps found in the specs, in the order the matrix reports them. */
function analyze(model) {
  const gaps = {
    noScenario: [],
    noTask: [],
    scenarioAcNotInSpec: [],
    scenarioWithoutAc: [],
    priorityMismatch: [],
    taskAcNotInSpec: [],
  };
  for (const ac of model.acs.keys()) {
    const prio = priorityOf(model, ac);
    if (!model.acScen.get(ac)?.length) gaps.noScenario.push([ac, prio]);
    if (!model.acTasks.get(ac)?.size) gaps.noTask.push([ac, prio]);
  }
  for (const s of model.scenarios) {
    for (const ac of s.acs)
      if (!model.acs.has(ac))
        gaps.scenarioAcNotInSpec.push([ac, s.file, s.name]);
    if (!s.acs.length) gaps.scenarioWithoutAc.push([s.file, s.name]);
    const story = model.stories.get(s.us[0]);
    if (story && s.prio.length && s.prio[0] !== story.prio) {
      gaps.priorityMismatch.push([
        s.file,
        s.name,
        s.prio[0],
        story.prio,
        s.us[0],
      ]);
    }
  }
  for (const [task, covered] of model.tasks) {
    for (const ac of covered)
      if (!model.acs.has(ac)) gaps.taskAcNotInSpec.push([task, ac]);
  }
  return gaps;
}

/** Planned test level of an AC, derived from its spec and scenario kinds. */
function levelOf(model, ac) {
  const spec = model.acs.get(ac).spec.slice(0, 3);
  const scenarios = model.acScen.get(ac) ?? [];
  const kinds = new Set(scenarios.flatMap((s) => s.kind));
  if (spec === '004' || spec === '005') {
    const levels = ['component'];
    if (MAESTRO_STORIES.has(model.acs.get(ac).story)) levels.push('maestro');
    if (spec === '005') levels.unshift('unit');
    return levels.join('+');
  }
  if (kinds.has('docs')) return 'review';
  if (spec === '007') return 'ci/compose-smoke';
  if (spec === '006') return 'integration+e2e';
  const levels = [];
  if (
    scenarios.some((s) => s.outline) ||
    (kinds.has('security') && spec === '001')
  )
    levels.push('unit');
  if (kinds.has('concurrency') || kinds.has('idempotency'))
    levels.push('integration');
  levels.push('e2e');
  return [...new Set(levels)].join('+');
}

const scenarioRef = (s) => `\`${basename(s.file)}\` › ${s.rule} › ${s.name}`;

/** Markdown of the matrix (unformatted; the CLI runs it through prettier). */
export function renderMatrix(model, brief) {
  const gaps = analyze(model);
  const out = [];
  const w = (line) => out.push(line);
  const acsOf = (prio) =>
    [...model.acs.keys()].filter((ac) => priorityOf(model, ac) === prio);

  w('# Traceability Matrix\n');
  w(
    'Brief requirement → epic → story (priority) → acceptance criteria → scenarios → planned test level → task. Generated from `docs/specs/*/spec.md`, `docs/specs/*/*.feature`, `docs/specs/*/tasks.md` and the traceability table of `docs/brief/README.md` by `tools/ci/traceability.mjs` (`pnpm traceability`; the CI `static` job fails when this file is stale). Only the structural part is committed so that parallel pull requests do not conflict: which ACs have automated tests is computed in CI from the `AC-…` ids that start test titles and reported in the job summary. Owner: qa-engineer. Do not edit rows by hand: fix the spec, the `.feature` tag or the task `Covers:` line and regenerate.\n',
  );
  w(
    "**Conventions.** Priority is the story priority in `spec.md` (scenario tags `@must/@should/@could` must equal it). _Level_ is the planned level (unit · integration · e2e = API supertest · component = RNTL · maestro · review · ci) derived from the scenario kind and spec; it is a plan, refined in each task's _Done when_. A task covers an AC when its `Covers:` line names it.\n",
  );
  w('## Summary\n');
  w('| Metric | Value |\n| --- | --- |');
  w(
    `| Specs / stories / acceptance criteria | ${model.specs.length} / ${model.stories.size} / ${model.acs.size} |`,
  );
  w(`| Scenarios | ${model.scenarios.length} |`);
  for (const prio of PRIORITIES) {
    const list = acsOf(prio);
    const withScenario = list.filter(
      (ac) => model.acScen.get(ac)?.length,
    ).length;
    const withTask = list.filter((ac) => model.acTasks.get(ac)?.size).length;
    w(
      `| \`${prio.toUpperCase()}\` ACs (with scenario / with task / total) | ${withScenario} / ${withTask} / ${list.length} |`,
    );
  }
  w(`| Tasks | ${model.tasks.size} |\n`);

  w('## Gaps and findings\n');
  const list = (title, items, format) => {
    w(`### ${title} (${items.length})\n`);
    if (!items.length) return w('None.\n');
    for (const item of items) w(`- ${format(item)}`);
    w('');
  };
  list(
    'Acceptance criteria without a scenario',
    gaps.noScenario,
    ([ac, p]) => `\`${ac}\` (${p.toUpperCase()})`,
  );
  const mustNoTask = gaps.noTask.filter(([, p]) => p === 'must');
  w(
    `### Acceptance criteria without a task (${gaps.noTask.length}; ${mustNoTask.length} MUST)\n`,
  );
  w(
    'A task covers an AC only if its `Covers:` line names it. Foundation tasks that say "no scenario" are not listed here.\n',
  );
  const byStory = new Map();
  for (const [ac, p] of gaps.noTask) {
    const story = model.acs.get(ac).story;
    if (!byStory.has(story)) byStory.set(story, []);
    byStory.get(story).push(`${ac}(${p[0].toUpperCase()})`);
  }
  for (const story of [...byStory.keys()].sort())
    w(`- ${story}: ${byStory.get(story).join(', ')}`);
  w('');
  list(
    'Scenario tags naming an AC that is not in a spec',
    gaps.scenarioAcNotInSpec,
    ([ac, file, name]) => `\`${ac}\` in \`${file}\` › ${name}`,
  );
  list(
    'Scenarios without an AC tag',
    gaps.scenarioWithoutAc,
    ([file, name]) => `\`${file}\` › ${name}`,
  );
  list(
    'Scenario priority differs from story priority',
    gaps.priorityMismatch,
    ([file, name, tagged, story]) =>
      `\`${file}\` › ${name}: tagged @${tagged}, story is ${story.toUpperCase()}`,
  );
  list(
    'Task `Covers:` naming an AC that is not in a spec',
    gaps.taskAcNotInSpec,
    ([task, ac]) => `${task} → \`${ac}\``,
  );

  w('## Brief requirement coverage\n');
  w(
    'Rows of the traceability table in the [brief](../brief/README.md#traceability-english); the B-* ids follow the row order of the brief traceability table (rows that are not pursued or have no level keep their number but are left out). _Status_: ✅ every AC of the mapped stories has a scenario and a task; ⚠️ some lack a task; ❌ some lack a scenario or no AC is mapped.\n',
  );
  w(
    '| Id | Brief requirement | Level | Stories | ACs | Scenarios | Tasks | Status |\n| --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const row of brief.filter((r) => r.counted)) {
    const covered = [...model.acs.keys()].filter(
      (ac) =>
        row.stories.includes(model.acs.get(ac).story) || row.acs.includes(ac),
    );
    const scenarioCount = new Set(
      covered.flatMap((ac) => model.acScen.get(ac) ?? []),
    ).size;
    const taskCount = new Set(
      covered.flatMap((ac) => [...(model.acTasks.get(ac) ?? [])]),
    ).size;
    const noScenario = covered.filter((ac) => !model.acScen.get(ac)?.length);
    const noTask = covered.filter((ac) => !model.acTasks.get(ac)?.size);
    const status = !covered.length
      ? '❌ no AC'
      : noScenario.length
        ? '❌ AC without scenario'
        : noTask.length
          ? `⚠️ ${noTask.length} AC without task`
          : '✅';
    const shown = [
      ...row.stories,
      ...row.acs.filter(
        (ac) => !row.stories.includes(model.acs.get(ac)?.story),
      ),
    ];
    w(
      `| ${row.id} | ${row.requirement} | ${row.level} | ${shown.join(', ') || '—'} | ${covered.length} | ${scenarioCount} | ${taskCount} | ${status} |`,
    );
  }
  w('');

  w('## Matrix by spec\n');
  for (const spec of model.specs) {
    w(`### ${spec}\n`);
    const epic = `EP-${spec.slice(1, 3)}`;
    const specStories = [...model.stories.keys()]
      .filter((id) => model.stories.get(id).spec === spec)
      .sort(byNumber);
    for (const id of specStories) {
      const story = model.stories.get(id);
      w(
        `**${id} — ${story.title}** (\`${story.prio.toUpperCase()}\`) · epic ${epic}\n`,
      );
      w(
        '| AC | Scenarios (file › rule › scenario) | Level | Tasks |\n| --- | --- | --- | --- |',
      );
      const storyAcs = [...model.acs.keys()]
        .filter((ac) => model.acs.get(ac).story === id)
        .sort(byNumber);
      for (const ac of storyAcs) {
        const refs = [
          ...new Set((model.acScen.get(ac) ?? []).map(scenarioRef)),
        ];
        const taskIds = [...(model.acTasks.get(ac) ?? [])].sort();
        w(
          `| ${ac} | ${refs.length ? refs.join('<br>') : '⚠️ **none**'} | ${levelOf(model, ac)} | ${taskIds.join(', ') || '⚠️ **none**'} |`,
        );
      }
      w('');
    }
  }
  return `${out.join('\n').replace(/\n+$/, '')}\n`;
}

/** Markdown for the CI job summary: how many ACs have tests and which MUST ACs have none yet. */
export function renderTestReport(model, tests) {
  const out = ['## Requirement traceability — automated tests\n'];
  out.push('| Priority | ACs with an automated test / total |\n| --- | --- |');
  const must = [];
  for (const prio of PRIORITIES) {
    const list = [...model.acs.keys()].filter(
      (ac) => priorityOf(model, ac) === prio,
    );
    const tested = list.filter((ac) => tests.get(ac)?.size);
    out.push(`| ${prio.toUpperCase()} | ${tested.length} / ${list.length} |`);
    if (prio === 'must')
      must.push(...list.filter((ac) => !tests.get(ac)?.size));
  }
  out.push('');
  out.push(
    `### MUST acceptance criteria without an automated test (${must.length})\n`,
  );
  out.push(
    'Progress marker, not a failure: the specs are implemented task by task. A test counts when the title of an `it`/`test`/`describe` starts with the AC id.\n',
  );
  const byStory = new Map();
  for (const ac of must) {
    const story = model.acs.get(ac).story;
    if (!byStory.has(story)) byStory.set(story, []);
    byStory.get(story).push(ac);
  }
  for (const story of [...byStory.keys()].sort(byNumber))
    out.push(`- ${story}: ${byStory.get(story).join(', ')}`);
  out.push('');
  return out.join('\n');
}

/** First differing lines between two texts, for the failure message. */
function diffExcerpt(committed, generated, max = 12) {
  const a = committed.split('\n');
  const b = generated.split('\n');
  const lines = [];
  for (
    let i = 0;
    i < Math.max(a.length, b.length) && lines.length < max * 2;
    i += 1
  ) {
    if (a[i] !== b[i]) {
      if (a[i] !== undefined) lines.push(`  - ${a[i].slice(0, 160)}`);
      if (b[i] !== undefined) lines.push(`  + ${b[i].slice(0, 160)}`);
    }
  }
  return lines.join('\n');
}

/** Problems with the shape of tools/ci/traceability-waivers.json: a list of { ac, reason }. */
export function validateWaivers(waivers) {
  if (!Array.isArray(waivers))
    return [`${WAIVERS} must be a JSON array of { ac, reason }`];
  return waivers.flatMap((waiver, index) => {
    const where = `waiver #${index + 1} in ${WAIVERS}`;
    if (typeof waiver !== 'object' || waiver === null)
      return [`${where} must be an object { ac, reason }`];
    const problems = [];
    if (!/^AC-\d\d\.\d+\.\d+$/.test(waiver.ac ?? ''))
      problems.push(`${where} needs an ac such as AC-01.2.3`);
    if (typeof waiver.reason !== 'string' || waiver.reason.trim() === '')
      problems.push(`${where} needs a non-empty reason`);
    return problems;
  });
}

/** Failures (block the PR) and warnings (reported) for the specs, tests and committed matrix. */
export function checkTraceability(
  model,
  tests,
  { committed, generated, baseTests, waivers = [] } = {},
) {
  const gaps = analyze(model);
  const failures = [];
  const warnings = [];
  for (const [ac, prio] of gaps.noScenario) {
    (prio === 'must' ? failures : warnings).push(
      `${ac} (${prio.toUpperCase()}) has no scenario`,
    );
  }
  for (const [ac, prio] of gaps.noTask) {
    (prio === 'must' ? failures : warnings).push(
      `${ac} (${prio.toUpperCase()}) has no task: name it on a task's Covers: line`,
    );
  }
  for (const [file, name, tagged, story, us] of gaps.priorityMismatch) {
    failures.push(
      `${file} › ${name}: tagged @${tagged} but ${us} is ${story.toUpperCase()}`,
    );
  }
  for (const [ac, file, name] of gaps.scenarioAcNotInSpec) {
    failures.push(
      `scenario "${name}" (${file}) names ${ac}, which is not in a spec`,
    );
  }
  for (const [task, ac] of gaps.taskAcNotInSpec) {
    failures.push(`${task} Covers: names ${ac}, which is not in a spec`);
  }
  failures.push(...validateWaivers(waivers));
  const lost = new Set();
  if (baseTests) {
    const waived = new Set(
      (Array.isArray(waivers) ? waivers : []).map((w) => w?.ac),
    );
    for (const [ac, files] of [...baseTests.entries()].sort(([x], [y]) =>
      byNumber(x, y),
    )) {
      if (!files.size || tests.get(ac)?.size) continue;
      lost.add(ac);
      const message = `${ac} lost its last test (it had one in ${[...files][0]} on the base); restore a test whose title starts with ${ac} or record a waiver with a reason in ${WAIVERS}`;
      (waived.has(ac) ? warnings : failures).push(
        waived.has(ac) ? `${message} [waived]` : message,
      );
    }
  }
  if (baseTests) {
    for (const waiver of Array.isArray(waivers) ? waivers : []) {
      if (waiver?.ac && !lost.has(waiver.ac)) {
        warnings.push(
          `waiver for ${waiver.ac} is stale: that AC did not lose a test; remove it from ${WAIVERS}`,
        );
      }
    }
  }
  if (
    committed !== undefined &&
    generated !== undefined &&
    committed !== generated
  ) {
    failures.push(
      `${MATRIX} is out of date: run pnpm traceability and commit the result\n${diffExcerpt(committed, generated)}`,
    );
  }
  return { failures, warnings };
}

/**
 * The base to compare tests with: --base <ref>, $BASE_SHA, or the merge-base with origin/main.
 * A pull request run must have one (`required`): a missing or unreadable base fails the check
 * instead of silently skipping the lost-test comparison.
 */
export function resolveBase(root, argv = process.argv, env = process.env) {
  const flag = argv.indexOf('--base');
  const required =
    flag >= 0 ||
    Boolean(env.BASE_SHA) ||
    env.GITHUB_EVENT_NAME === 'pull_request';
  if (flag >= 0) return { ref: argv[flag + 1], required };
  if (env.BASE_SHA) return { ref: env.BASE_SHA, required };
  if (required) return { ref: undefined, required };
  try {
    const ref = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    return { ref, required };
  } catch {
    return { ref: undefined, required };
  }
}

async function main() {
  const root = process.cwd();
  const write = process.argv.includes('--write');
  const model = loadModel(root);
  const tests = scanTests(root);
  const briefPath = join(root, 'docs/brief/README.md');
  const brief = existsSync(briefPath) ? parseBrief(read(briefPath)) : [];
  const prettier = await import('prettier');
  const matrixPath = join(root, MATRIX);
  const options = {
    ...((await prettier.resolveConfig(matrixPath)) ?? {}),
    parser: 'markdown',
  };
  const generated = await prettier.format(renderMatrix(model, brief), options);
  const committed = existsSync(matrixPath) ? read(matrixPath) : undefined;
  const waiversPath = join(root, WAIVERS);
  let waivers = [];
  if (existsSync(waiversPath)) {
    try {
      waivers = JSON.parse(read(waiversPath));
    } catch (error) {
      waivers = { invalid: String(error.message) };
    }
  }
  const { ref, required } = resolveBase(root);
  let baseTests;
  const baseFailures = [];
  if (ref) {
    try {
      baseTests = scanTestsAt(root, ref);
    } catch {
      const message = `the base ${ref} cannot be scanned (is it fetched?), so lost tests cannot be detected`;
      if (required) baseFailures.push(message);
      else console.warn(`warning: ${message}; skipping the comparison`);
    }
  } else if (required) {
    baseFailures.push(
      'no base to compare tests with: set BASE_SHA or pass --base <ref>',
    );
  }
  const result = checkTraceability(model, tests, {
    committed,
    generated,
    baseTests,
    waivers,
  });
  const failures = [...baseFailures, ...result.failures];
  const { warnings } = result;
  if (write) {
    writeFileSync(matrixPath, generated);
    console.log(`${MATRIX} regenerated.`);
  }
  const report = renderTestReport(model, tests);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  }
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  const blocking = write
    ? failures.filter((f) => !f.includes('is out of date'))
    : failures;
  if (blocking.length) {
    console.error(
      `Traceability check failed:\n${blocking.map((f) => `  - ${f}`).join('\n')}`,
    );
    process.exit(1);
  }
  const withTests = [...tests.values()].filter((files) => files.size).length;
  console.log(
    `Traceability check passed (${model.acs.size} ACs, ${model.scenarios.length} scenarios, ${withTests} ACs with tests; tests compared with ${baseTests ? ref.slice(0, 9) : 'no base'}).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
