import { ColorHex } from './color-hex';
import { InvalidColorHex } from '../team.errors';

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
