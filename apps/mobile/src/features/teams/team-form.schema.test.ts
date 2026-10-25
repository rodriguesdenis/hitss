import { normalizeHex, teamFormSchema } from './team-form.schema';

const valid = { name: 'Mobile', colorHex: '#6366F1', description: '' };

describe('team form schema', () => {
  it.each([
    ['a', false],
    ['ab', true],
    ['a'.repeat(50), true],
    ['a'.repeat(51), false],
    ['  a  ', false],
  ])('AC-04.3.1 name %j is valid: %s', (name, ok) => {
    const result = teamFormSchema.safeParse({ ...valid, name });
    expect(result.success).toBe(ok);
    if (!ok) {
      expect(result.error?.issues[0]?.message).toBe(
        'O nome deve ter de 2 a 50 caracteres',
      );
    }
  });

  it.each([
    ['#6366f1', '#6366F1'],
    ['6366F1', '#6366F1'],
    [' #ec4899 ', '#EC4899'],
    ['#12', null],
    ['#GGGGGG', null],
  ])('AC-04.3.5 normalizes hex %j to %j', (input, output) => {
    expect(normalizeHex(input)).toBe(output);
  });

  it('AC-04.3.5 rejects an invalid hex with the design copy', () => {
    const result = teamFormSchema.safeParse({ ...valid, colorHex: '#12' });
    expect(result.error?.issues[0]?.message).toBe('Use uma cor como #6366F1');
  });

  it('trims the name, uppercases the color and sends null for no description', () => {
    expect(
      teamFormSchema.parse({
        name: ' QA ',
        colorHex: 'ec4899',
        description: ' ',
      }),
    ).toEqual({ name: 'QA', colorHex: '#EC4899', description: null });
  });

  it('limits the description to 280 characters', () => {
    expect(
      teamFormSchema.safeParse({ ...valid, description: 'x'.repeat(281) }).error
        ?.issues[0]?.message,
    ).toBe('A descrição deve ter no máximo 280 caracteres');
  });
});
