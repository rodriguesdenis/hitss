import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

function read(dir: string, pattern: RegExp): string[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((file) => pattern.test(file) && !file.includes('.test.'))
    .map((file) => readFileSync(join(root, dir, file), 'utf8'));
}

const source = [...read('src', /\.tsx?$/), ...read('app', /\.tsx?$/)].join(
  '\n',
);

const literal = new Set(
  [
    ...source.matchAll(/(?:testID|tabBarButtonTestID)[=:]\s*["']([\w-]+)["']/g),
  ].map((match) => match[1]),
);

const prefixes = [...source.matchAll(/testID=\{[^}]*`([\w-]+)\$\{/g)].map(
  (match) => match[1]!,
);

const flowIds = [
  ...new Set(
    read('tests/maestro', /\.yaml$/)
      .flatMap((flow) => [...flow.matchAll(/id: '([\w-]+)'/g)])
      .map((match) => match[1]!),
  ),
];

describe('Maestro flows', () => {
  it('reference ids', () => {
    expect(flowIds.length).toBeGreaterThan(5);
  });

  it.each(flowIds)('%s exists as a testID in the app', (id) => {
    expect(
      literal.has(id) ||
        prefixes.some((prefix) => id.startsWith(prefix)) ||
        [...literal].some((parent) => id.startsWith(`${parent}-`)),
    ).toBe(true);
  });
});
