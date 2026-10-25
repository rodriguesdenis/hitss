import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const features = join(__dirname, '../src/features');

const sources = readdirSync(features, { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => ({ file, text: readFileSync(join(features, file), 'utf8') }));

describe('form stack', () => {
  const forms = sources.filter(
    ({ text }) => /\buseForm\s*</.test(text) || /\buseForm\(/.test(text),
  );

  it('finds the feature forms', () => {
    expect(forms.map(({ file }) => file)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('useTeamForm'),
        expect.stringContaining('useTaskForm'),
      ]),
    );
  });

  it.each(
    sources
      .filter(({ text }) => /\buseForm\b/.test(text))
      .map(({ file, text }) => [file, text]),
  )(
    'AC-04.15.2 %s validates with react-hook-form and zodResolver',
    (_file, text) => {
      expect(text).toMatch(/from 'react-hook-form'/);
      expect(text).toMatch(/resolver:\s*zodResolver\(/);
    },
  );
});
