import { ColorHex } from './color-hex';
import { InvalidColorHex } from './errors/invalid-color-hex.error';

describe('ColorHex', () => {
  describe('AC-02.1.3 valid colors are normalized to upper case', () => {
    it.each([
      ['#0ea5e9', '#0EA5E9'],
      ['#0EA5E9', '#0EA5E9'],
      ['#aBcDeF', '#ABCDEF'],
      ['#000000', '#000000'],
    ])('%s is stored as %s', (input, stored) => {
      expect(ColorHex.create(input).value).toBe(stored);
    });
  });

  describe('AC-02.1.3 invalid colors are rejected', () => {
    it.each([
      '#FFF',
      '7C3AED',
      '#7C3AED0',
      '#GGGGGG',
      'red',
      '#7C3AE',
      ' #7C3AED',
      '#7C3AED ',
      '#7C3AED\n',
      '',
    ])('rejects %j', (input) => {
      expect(() => ColorHex.create(input)).toThrow(InvalidColorHex);
    });

    it('reports the "colorHex" field', () => {
      let error: unknown;
      try {
        ColorHex.create('red');
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(InvalidColorHex);
      expect(error).toMatchObject({
        field: 'colorHex',
        message: 'Color must be a hex color in the form #RRGGBB.',
      });
    });
  });

  describe('contrastingTextColor (WCAG relative luminance, design-spec §3)', () => {
    it.each([
      ['#FFFFFF', '#000000'],
      ['#ffffff', '#000000'],
      ['#000000', '#FFFFFF'],
      // design-spec §1.3 presets
      ['#EF4444', '#000000'],
      ['#F97316', '#000000'],
      ['#F59E0B', '#000000'],
      ['#EAB308', '#000000'],
      ['#84CC16', '#000000'],
      ['#10B981', '#000000'],
      ['#14B8A6', '#000000'],
      ['#0EA5E9', '#000000'],
      ['#3B82F6', '#000000'],
      ['#6366F1', '#000000'],
      ['#7C3AED', '#FFFFFF'],
      ['#EC4899', '#000000'],
      ['#64748B', '#FFFFFF'],
      ['#1E293B', '#FFFFFF'],
      // around the ≈ 0.179 luminance threshold
      ['#757575', '#FFFFFF'],
      ['#777777', '#000000'],
      // dark channels use the linear segment (c ≤ 0.03928); getting it wrong flips this one to black
      ['#018900', '#FFFFFF'],
      // each channel weighs differently
      ['#FF0000', '#000000'],
      ['#00FF00', '#000000'],
      ['#0000FF', '#FFFFFF'],
    ])('%s gets %s text', (background, text) => {
      expect(ColorHex.create(background).contrastingTextColor()).toBe(text);
    });
  });

  describe('equals', () => {
    it('compares normalized values', () => {
      expect(
        ColorHex.create('#abcdef').equals(ColorHex.create('#ABCDEF')),
      ).toBe(true);
      expect(
        ColorHex.create('#ABCDEF').equals(ColorHex.create('#ABCDEE')),
      ).toBe(false);
    });
  });
});
