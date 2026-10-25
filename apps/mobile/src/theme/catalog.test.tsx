import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Text } from 'react-native';
import { colorScheme, render, screen } from 'nativewind/test';

import tailwindConfig from '../../tailwind.config.js';

const { content: _content, ...config } = tailwindConfig;

const css = readFileSync(join(__dirname, 'global.css'), 'utf8');

const catalog = [
  ...css
    .slice(css.indexOf('@layer components'))
    .matchAll(/^ {2}\.([a-z_-]+) \{/gm),
].map((match) => match[1]!);

async function renderCatalog(scheme: 'light' | 'dark') {
  colorScheme.set(scheme);
  await render(
    <>
      {catalog.map((name) => (
        <Text key={name} testID={name} className={name}>
          {name}
        </Text>
      ))}
    </>,
    { config, css },
  );
  return Object.fromEntries(
    catalog.map((name) => [name, screen.getByTestId(name).props.style]),
  );
}

describe('semantic class catalog', () => {
  it('declares the design-spec catalog', () => {
    expect(catalog).toEqual(
      expect.arrayContaining([
        'screen',
        'card',
        'btn-primary',
        'input',
        'chip',
        'badge-status-done',
        'segmented',
        'toast',
        'sheet',
        'form-footer',
      ]),
    );
  });

  it.each([
    ['light', 'rgba(248, 250, 252, 1)', 'rgba(15, 23, 42, 1)'],
    ['dark', 'rgba(11, 17, 32, 1)', 'rgba(241, 245, 249, 1)'],
  ] as const)(
    'resolves every class with the %s tokens',
    async (scheme, canvas, fg) => {
      const styles = await renderCatalog(scheme);
      const unstyled = catalog.filter(
        (name) => !styles[name] || Object.keys(styles[name]).length === 0,
      );
      expect(unstyled).toEqual([]);
      expect(styles.screen.backgroundColor).toBe(canvas);
      expect(styles['type-body'].color).toBe(fg);
      expect(styles['btn-primary']).toMatchObject({ minHeight: 48 });
    },
  );
});
