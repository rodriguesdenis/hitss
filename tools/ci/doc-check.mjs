import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_SECTIONS = new URL(
  './readme-required-sections.json',
  import.meta.url,
);

/** Heading text without Markdown decoration (links, code spans, emphasis). */
function plainText(heading) {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

/** GitHub's anchor for a heading: lowercase, punctuation dropped, spaces to hyphens. */
export function githubSlug(heading) {
  return plainText(heading)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

/** Lines with fenced code blocks blanked out, so headings and links inside them are ignored. */
function proseLines(text) {
  let fence = null;
  return text.split(/\r?\n/).map((line) => {
    const marker = /^\s*(```+|~~~+)/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length)
        fence = null;
      return '';
    }
    if (marker) {
      fence = marker;
      return '';
    }
    return line;
  });
}

/** [{ level, title, line }] for every ATX heading outside code fences. */
function headingsOf(lines) {
  return lines.flatMap((line, index) => {
    const match = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    return match
      ? [{ level: match[1].length, title: plainText(match[2]), line: index }]
      : [];
  });
}

/** Anchors GitHub would generate for the headings, including the -1, -2 suffix for duplicates. */
function anchorsOf(headings) {
  const seen = new Map();
  return new Set(
    headings.map(({ title }) => {
      const slug = githubSlug(title);
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      return count === 0 ? slug : `${slug}-${count}`;
    }),
  );
}

const normalize = (title) => title.toLowerCase().replace(/\s+/g, ' ').trim();

function checkSections(lines, headings, sections) {
  const problems = [];
  for (const spec of sections) {
    const names = [spec.title, ...(spec.aliases ?? [])].map(normalize);
    const index = headings.findIndex((h) => names.includes(normalize(h.title)));
    if (index === -1) {
      problems.push(`Required README section "${spec.title}" is missing`);
      continue;
    }
    const heading = headings[index];
    const next = headings
      .slice(index + 1)
      .find((h) => h.level <= heading.level);
    const body = lines.slice(heading.line + 1, next ? next.line : lines.length);
    if (body.every((line) => line.trim() === '')) {
      problems.push(`Required README section "${spec.title}" is empty`);
      continue;
    }
    const inside = headings.slice(
      index + 1,
      next ? headings.indexOf(next) : headings.length,
    );
    for (const sub of spec.subsections ?? []) {
      if (
        !inside.some(
          (h) =>
            h.level > heading.level &&
            new RegExp(sub.pattern, 'i').test(h.title),
        )
      ) {
        problems.push(`Section "${spec.title}" lacks a ${sub.name} subsection`);
      }
    }
    const text = body.join('\n');
    for (const topic of spec.topics ?? []) {
      if (!new RegExp(topic.pattern, 'i').test(text)) {
        problems.push(`Section "${spec.title}" does not mention ${topic.name}`);
      }
    }
  }
  return problems;
}

function checkLinks(readmePath, lines, ownAnchors) {
  const problems = [];
  const name = basename(readmePath);
  const prose = lines.map((line) => line.replace(/`[^`]*`/g, ''));
  for (const line of prose) {
    for (const [, raw] of line.matchAll(
      /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    )) {
      if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue;
      const [path = '', fragment] = decodeURI(raw).split('#');
      if (path === '') {
        if (fragment && !ownAnchors.has(fragment.toLowerCase())) {
          problems.push(`${name}: broken anchor "${raw}" (no such heading)`);
        }
        continue;
      }
      const target = resolve(dirname(readmePath), path.replace(/^\//, ''));
      if (!existsSync(target)) {
        problems.push(`${name}: broken link "${raw}" (file not found)`);
      } else if (
        fragment &&
        statSync(target).isFile() &&
        target.endsWith('.md')
      ) {
        const anchors = anchorsOf(
          headingsOf(proseLines(readFileSync(target, 'utf8'))),
        );
        if (!anchors.has(fragment.toLowerCase())) {
          problems.push(
            `${name}: broken anchor "${raw}" (no such heading in ${path})`,
          );
        }
      }
    }
  }
  return problems;
}

/** Problems found in the README: missing/empty required sections, missing topics, broken links. */
export function checkReadme(readmePath, sections) {
  const lines = proseLines(readFileSync(readmePath, 'utf8'));
  const headings = headingsOf(lines);
  return [
    ...checkSections(lines, headings, sections),
    ...checkLinks(readmePath, lines, anchorsOf(headings)),
  ];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sections = JSON.parse(readFileSync(REQUIRED_SECTIONS, 'utf8'));
  const problems = checkReadme(
    resolve(process.argv[2] ?? 'README.md'),
    sections,
  );
  if (problems.length > 0) {
    console.error(
      `README check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
    process.exit(1);
  }
  console.log('README check passed.');
}
