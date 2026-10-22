import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), 'utf8');

const plan = read('docs/operations/production-readiness.md');

/** `## Heading` → the tables under it (header cells and body rows). */
function sections(markdown) {
  const result = new Map();
  let current;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      current = { title: heading[1], rows: [] };
      result.set(heading[1], current);
    } else if (current && line.startsWith('|')) {
      current.rows.push(
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
    }
  }
  return result;
}

const parsed = sections(plan);
const find = (pattern) =>
  [...parsed.values()].find((section) => pattern.test(section.title));

describe('production-readiness plan', () => {
  it('AC-06.8.1 covers caching, logging, scalability, security, reliability, delivery and data lifecycle', () => {
    for (const topic of [
      /caching/i,
      /logging/i,
      /scalability/i,
      /security/i,
      /reliability/i,
      /cd pipeline|delivery/i,
      /data lifecycle/i,
    ]) {
      const section = find(topic);
      assert.ok(section, `no section for ${topic}`);
      assert.ok(section.rows.length > 2, `${topic} has no rows`);
    }
  });

  it('AC-06.8.2 every item states today, in production and (where tabulated) why or when', () => {
    for (const section of parsed.values()) {
      const [header] = section.rows;
      if (!header || !/^today$/i.test(header[0] ?? '')) continue;
      assert.match(
        header[1] ?? '',
        /in production/i,
        `${section.title} header`,
      );
      const body = section.rows.slice(2);
      assert.ok(body.length > 0, `${section.title} has no items`);
      for (const row of body) {
        assert.ok(
          row[0],
          `${section.title}: empty "today" in ${row.join(' | ')}`,
        );
        assert.ok(
          row[1],
          `${section.title}: empty "in production" for ${row[0]}`,
        );
      }
    }
  });

  it('AC-06.8.3 is linked from the project README', () => {
    assert.match(
      read('README.md'),
      /\]\(docs\/operations\/production-readiness\.md\)/,
    );
  });
});
