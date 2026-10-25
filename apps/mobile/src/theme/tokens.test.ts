import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { overlayAlpha, tokens } from './tokens';

const css = readFileSync(join(__dirname, 'global.css'), 'utf8');

function variables(selector: string) {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  const colors = Object.fromEntries(
    [...block.matchAll(/--color-([a-z-]+): (\d+) (\d+) (\d+);/g)].map(
      ([, role, ...rgb]) => [
        role,
        `#${rgb.map((c: string) => Number(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase(),
      ],
    ),
  );
  const alpha = Number(/--alpha-overlay: ([\d.]+);/.exec(block)?.[1]);
  return { colors, alpha };
}

describe('tokens.ts mirrors global.css', () => {
  it.each([
    ['light', ':root'],
    ['dark', '.dark:root'],
  ] as const)('%s matches %s', (scheme, selector) => {
    const { colors, alpha } = variables(selector);
    expect(tokens[scheme]).toEqual(colors);
    expect(overlayAlpha[scheme]).toBe(alpha);
  });
});
