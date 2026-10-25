import { contrastRatio, contrastingText, needsOutline } from './contrast';
import { tokens, type ColorRole, type ColorScheme } from './tokens';

const presets: [string, string, 'black' | 'white', number, boolean, boolean][] =
  [
    ['Red', '#EF4444', 'black', 5.6, false, false],
    ['Orange', '#F97316', 'black', 7.5, true, false],
    ['Amber', '#F59E0B', 'black', 9.8, true, false],
    ['Yellow', '#EAB308', 'black', 11.0, true, false],
    ['Lime', '#84CC16', 'black', 10.6, true, false],
    ['Emerald', '#10B981', 'black', 8.3, true, false],
    ['Teal', '#14B8A6', 'black', 8.4, true, false],
    ['Sky', '#0EA5E9', 'black', 7.6, true, false],
    ['Blue', '#3B82F6', 'black', 5.7, false, false],
    ['Indigo', '#6366F1', 'black', 4.7, false, false],
    ['Violet', '#7C3AED', 'white', 5.7, false, false],
    ['Pink', '#EC4899', 'black', 6.0, false, false],
    ['Slate', '#64748B', 'white', 4.8, false, false],
    ['Ink', '#1E293B', 'white', 14.6, false, true],
  ];

const hexOf = { black: '#000000', white: '#FFFFFF' } as const;

describe('team chip rule', () => {
  it.each(presets)(
    'AC-04.8.2 %s %s uses %s text at %f:1',
    (_name, hex, text, ratio) => {
      expect(contrastingText(hex)).toBe(hexOf[text]);
      expect(contrastRatio(hex, hexOf[text])).toBeCloseTo(ratio, 1);
      expect(contrastRatio(hex, hexOf[text])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(
    presets.map(([name, hex, , , light, dark]) => ({ name, hex, light, dark })),
  )(
    'AC-04.8.2 $name $hex needs an outline: light $light, dark $dark',
    ({ hex, light, dark }) => {
      expect(needsOutline(hex, tokens.light.surface)).toBe(light);
      expect(needsOutline(hex, tokens.dark.surface)).toBe(dark);
    },
  );

  it('accepts lowercase hex without the hash', () => {
    expect(contrastingText('1e293b')).toBe('#FFFFFF');
  });

  it('rejects malformed colors', () => {
    expect(() => contrastingText('#FFF')).toThrow('Invalid hex color: #FFF');
  });
});

const textPairs: [ColorRole, ColorRole][] = [
  ['fg', 'surface'],
  ['fg', 'canvas'],
  ['fg-muted', 'surface'],
  ['fg-subtle', 'surface'],
  ['fg-subtle', 'canvas'],
  ['primary', 'surface'],
  ['on-primary', 'primary'],
  ['danger', 'surface'],
  ['on-danger', 'danger'],
  ['success', 'surface'],
  ['warning', 'surface'],
  ['fg', 'warning-soft'],
  ['on-info-soft', 'info-soft'],
  ['on-inverse', 'inverse'],
  ['inverse-action', 'inverse'],
  ['status-pending-fg', 'status-pending-bg'],
  ['status-progress-fg', 'status-progress-bg'],
  ['status-done-fg', 'status-done-bg'],
];

const schemes: ColorScheme[] = ['light', 'dark'];

describe('AC-04.12.2 token contrast', () => {
  it.each(
    schemes.flatMap((scheme) =>
      textPairs.map(([fg, bg]) => [scheme, fg, bg] as const),
    ),
  )('%s: %s on %s is at least 4.5:1', (scheme, fg, bg) => {
    expect(
      contrastRatio(tokens[scheme][fg], tokens[scheme][bg]),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(schemes)('%s: border-strong on surface is at least 3:1', (scheme) => {
    expect(
      contrastRatio(tokens[scheme]['border-strong'], tokens[scheme].surface),
    ).toBeGreaterThanOrEqual(3);
  });
});
