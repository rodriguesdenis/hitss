import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkReadme, githubSlug } from './doc-check.mjs';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sections = JSON.parse(
  readFileSync(join(root, 'tools/ci/readme-required-sections.json'), 'utf8'),
);

const GOOD = `# Project

## Architectural decisions

We chose PostgreSQL. See [the ADR](docs/adr.md).

## Data model

Users own teams.

## How to run

Intro.

### Backend

\`docker compose up\`

### Mobile app

\`pnpm start\`

## What I'd do differently in production

Caching with Redis, structured logging, horizontal scalability and a security review.
`;

const dirs = [];
/** Writes a README (plus support files) in a temp project and returns the problems found. */
function check(readme, files = { 'docs/adr.md': '# ADR\n' }) {
  const dir = mkdtempSync(join(tmpdir(), 'doc-check-'));
  dirs.push(dir);
  for (const [path, text] of Object.entries({
    'README.md': readme,
    ...files,
  })) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return checkReadme(join(dir, 'README.md'), sections);
}

describe('README doc-check', () => {
  after(() =>
    dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
  );

  it('AC-07.4.9 a complete README passes', () => {
    assert.deepEqual(check(GOOD), []);
  });

  for (const title of ['Architectural decisions', 'Data model', 'How to run']) {
    it(`AC-07.4.9 fails naming the missing "${title}" section`, () => {
      const readme = GOOD.replace(`## ${title}`, `## Something else`);
      assert.match(check(readme).join('\n'), new RegExp(`"${title}"`));
    });
  }

  it('AC-07.4.9 fails naming the missing production section', () => {
    const readme = GOOD.replace(
      "## What I'd do differently in production",
      '## Later',
    );
    assert.match(
      check(readme).join('\n'),
      /What I would do differently in production/,
    );
  });

  it('AC-07.4.9 accepts "What I would do differently in production" as the title', () => {
    assert.deepEqual(check(GOOD.replace("What I'd do", 'What I would do')), []);
  });

  it('AC-07.4.9 fails on an empty required section', () => {
    const readme = GOOD.replace('Users own teams.\n', '');
    assert.match(check(readme).join('\n'), /"Data model".*empty/);
  });

  for (const sub of ['Backend', 'Mobile app']) {
    it(`AC-07.4.7 fails when "How to run" lacks a ${sub} subsection`, () => {
      const readme = GOOD.replace(`### ${sub}`, '### Other');
      assert.match(
        check(readme).join('\n'),
        new RegExp(`"How to run".*${sub.split(' ')[0].toLowerCase()}`),
      );
    });
  }

  for (const topic of ['caching', 'logging', 'scalability', 'security']) {
    it(`AC-07.4.8 fails when the production section does not mention ${topic}`, () => {
      const body = {
        caching: 'Caching with Redis, ',
        logging: 'structured logging, ',
        scalability: 'horizontal scalability and ',
        security: 'a security review.',
      };
      const without = Object.entries(body)
        .filter(([key]) => key !== topic)
        .map(([, text]) => text)
        .join('');
      const readme = GOOD.replace(/Caching with Redis.*\n$/, `${without}\n`);
      assert.match(
        check(readme).join('\n'),
        new RegExp(`production.*${topic}`),
      );
    });
  }

  it('AC-07.4.9 fails on a broken relative link naming the link', () => {
    const problems = check(GOOD.replace('docs/adr.md', 'docs/missing.md'));
    assert.match(problems.join('\n'), /README\.md.*docs\/missing\.md/);
  });

  it('AC-07.4.9 fails on a broken anchor in another file and in the README', () => {
    const other = check(GOOD + '\n[x](docs/adr.md#nope)\n');
    assert.match(other.join('\n'), /docs\/adr\.md#nope/);
    const self = check(GOOD + '\n[x](#nope)\n');
    assert.match(self.join('\n'), /#nope/);
  });

  it('AC-07.4.9 accepts valid anchors, external links and links inside code', () => {
    const readme =
      GOOD +
      '\n[self](#data-model) [other](docs/adr.md#adr) [web](https://example.com/x) [mail](mailto:a@b.c)\n\n```md\n[ignored](nowhere.md)\n```\n\n`[inline](nowhere.md)`\n';
    assert.deepEqual(check(readme), []);
  });

  it('AC-07.4.9 slugs headings like GitHub', () => {
    assert.equal(
      githubSlug("What I'd do differently in production"),
      'what-id-do-differently-in-production',
    );
    assert.equal(githubSlug('Mobile app (Expo Go)'), 'mobile-app-expo-go');
  });

  it('AC-07.4.9 the committed README passes', () => {
    assert.deepEqual(checkReadme(join(root, 'README.md'), sections), []);
  });
});
