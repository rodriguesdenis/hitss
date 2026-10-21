import { InvalidTeamDescription } from './errors/invalid-team-description.error';
import { TeamDescription } from './team-description';

const EMOJI = '\u{1F680}';

describe('TeamDescription', () => {
  describe('AC-02.1.4 length boundaries (code points after trimming)', () => {
    it('accepts 280 characters', () => {
      expect(TeamDescription.create('d'.repeat(280)).value).toBe(
        'd'.repeat(280),
      );
    });

    it('rejects 281 characters', () => {
      expect(() => TeamDescription.create('d'.repeat(281))).toThrow(
        InvalidTeamDescription,
      );
    });

    it('accepts 280 emoji (counted as characters, not UTF-16 units)', () => {
      expect(TeamDescription.create(EMOJI.repeat(280)).value).toBe(
        EMOJI.repeat(280),
      );
    });

    it('rejects 281 emoji', () => {
      expect(() => TeamDescription.create(EMOJI.repeat(281))).toThrow(
        InvalidTeamDescription,
      );
    });

    it('trims, then measures: 280 characters surrounded by spaces are accepted', () => {
      const text = 'd'.repeat(280);

      expect(TeamDescription.create(`   ${text}   `).value).toBe(text);
    });

    it('rejects 281 characters surrounded by spaces (trimming never forgives length)', () => {
      expect(() => TeamDescription.create(`   ${'d'.repeat(281)}   `)).toThrow(
        InvalidTeamDescription,
      );
    });

    it.each([
      ['NBSP', '\u00a0'],
      ['LINE SEPARATOR', '\u2028'],
    ])('trims %s at the edges before measuring', (_label, edge) => {
      const text = 'd'.repeat(280);

      expect(TeamDescription.create(`${edge}${text}${edge}`).value).toBe(text);
    });

    it('reports the "description" field', () => {
      let error: unknown;
      try {
        TeamDescription.create('d'.repeat(281));
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(InvalidTeamDescription);
      expect(error).toMatchObject({
        field: 'description',
        message:
          'Description must be at most 280 characters long and contain no control characters other than line breaks.',
      });
    });
  });

  describe('AC-02.1.4 blank descriptions become no description', () => {
    it.each([undefined, null, '', '    ', '\n\r\n ', '\u00a0\u2028'])(
      '%j → null',
      (raw) => {
        expect(TeamDescription.create(raw).value).toBeNull();
      },
    );
  });

  describe('AC-02.1.11 control characters other than line breaks', () => {
    it.each([
      ['LF', 'line 1\nline 2'],
      ['CRLF', 'line 1\r\nline 2'],
      ['CR', 'line 1\rline 2'],
    ])('keeps %s line breaks inside', (_label, raw) => {
      expect(TeamDescription.create(raw).value).toBe(raw);
    });

    it.each([
      ['a tab', 'col 1\tcol 2'],
      ['a NUL character', 'text\u0000'],
      ['an escape character', 'text\u001b[31m'],
      ['a DEL character', 'text\u007f'],
      ['a C1 control character', 'text\u0085'],
      ['a trailing tab (checked before trimming)', 'text\t'],
      ['a tab-only description (not silently blank)', '\t'],
    ])('rejects %s', (_label, raw) => {
      expect(() => TeamDescription.create(raw)).toThrow(InvalidTeamDescription);
    });
  });

  it('keeps inner line breaks', () => {
    expect(TeamDescription.create(' line 1\nline 2 ').value).toBe(
      'line 1\nline 2',
    );
  });

  describe('equals', () => {
    it.each([
      ['APIs', ' APIs ', true],
      [null, '', true],
      ['APIs', 'apis', false],
      ['APIs', null, false],
      [null, 'APIs', false],
    ])('%j equals %j: %s', (a, b, expected) => {
      expect(TeamDescription.create(a).equals(TeamDescription.create(b))).toBe(
        expected,
      );
    });
  });
});
