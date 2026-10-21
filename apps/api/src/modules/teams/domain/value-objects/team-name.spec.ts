import { InvalidTeamName } from '../team.errors';
import { TeamName } from './team-name';

const ACCENTED = '\u00e9'; // e acute, one code point
const EMOJI = '\u{1F680}'; // rocket emoji, one code point, two UTF-16 units

describe('TeamName', () => {
  describe('AC-02.1.2 length boundaries (code points after trimming)', () => {
    it.each([
      [1, false],
      [2, true],
      [50, true],
      [51, false],
    ])('a name of %i characters is accepted: %s', (length, accepted) => {
      const create = () => TeamName.create('a'.repeat(length));

      if (accepted) {
        expect(create().value).toBe('a'.repeat(length));
      } else {
        expect(create).toThrow(InvalidTeamName);
      }
    });

    it.each(['   ', '  a  ', ''])('rejects %j', (raw) => {
      expect(() => TeamName.create(raw)).toThrow(InvalidTeamName);
    });

    it('accepts "  ab  " as "ab"', () => {
      expect(TeamName.create('  ab  ').value).toBe('ab');
    });

    it('keeps inner spaces as typed', () => {
      expect(TeamName.create(' Mobile  Team ').value).toBe('Mobile  Team');
    });

    it('rejects 51 characters surrounded by spaces (trimming never forgives length)', () => {
      expect(() => TeamName.create(`  ${'a'.repeat(51)}  `)).toThrow(
        InvalidTeamName,
      );
    });

    // NBSP (U+00A0) and LINE SEPARATOR (U+2028) are whitespace but not Cc:
    // trim() removes them at the edges, inside the name they are kept.
    it.each([
      ['NBSP at the edges', '\u00a0Mobile\u00a0', 'Mobile'],
      ['NBSP inside', 'Mobile\u00a0Team', 'Mobile\u00a0Team'],
      ['LINE SEPARATOR at the edges', '\u2028Mobile\u2028', 'Mobile'],
      ['LINE SEPARATOR inside', 'Mobile\u2028Team', 'Mobile\u2028Team'],
    ])('%s: accepted as %j', (_label, raw, stored) => {
      expect(TeamName.create(raw).value).toBe(stored);
    });

    it.each([
      ['NBSP', '\u00a0a\u00a0'],
      ['LINE SEPARATOR', '\u2028a\u2028'],
    ])(
      '%s around a single character is trimmed, then too short',
      (_label, raw) => {
        expect(() => TeamName.create(raw)).toThrow(InvalidTeamName);
      },
    );

    it('accepts 50 characters made of accented letters and emoji', () => {
      const raw = ACCENTED.repeat(25) + EMOJI.repeat(25);
      expect(raw.length).toBe(75); // UTF-16 units

      expect(TeamName.create(raw).value).toBe(raw);
    });

    it('rejects 51 emoji even though each is a single character', () => {
      expect(() => TeamName.create(EMOJI.repeat(51))).toThrow(InvalidTeamName);
    });

    it('accepts 50 emoji', () => {
      expect(TeamName.create(EMOJI.repeat(50)).value).toBe(EMOJI.repeat(50));
    });
  });

  describe('AC-02.1.10 control characters', () => {
    it.each([
      ['a newline between two words', 'Mobile\nTeam'],
      ['a tab between two words', 'Mobile\tTeam'],
      ['a NUL character', 'ab\u0000'],
      ['an escape character', 'Mobile\u001bTeam'],
      ['a carriage return at the end', 'Mobile\r'],
      ['a leading newline', '\nMobile'],
      ['a DEL character', 'Mobile\u007f'],
      ['a C1 control character', 'Mobile\u0085'],
    ])('rejects %s', (_label, raw) => {
      expect(() => TeamName.create(raw)).toThrow(InvalidTeamName);
    });
  });

  it('reports the "name" field with a message that does not echo the input', () => {
    let error: unknown;
    try {
      TeamName.create('x');
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(InvalidTeamName);
    expect(error).toMatchObject({
      field: 'name',
      message:
        'Team name must be 2 to 50 characters long and contain no control characters.',
    });
  });

  describe('equals (case-insensitive, same as the lower(name) unique index)', () => {
    it.each([
      ['Mobile', 'MOBILE', true],
      ['Mobile', 'mobile', true],
      ['\u03a9mega', '\u03c9mega', true], // capital / small omega
      ['\u00c9quipe', '\u00e9quipe', true], // capital / small e acute
      ['\u00c9quipe', 'Equipe', false], // accents are significant
      ['Mobile', 'Backend', false],
      // Greek sigma: PostgreSQL lower() maps each code point on its own, so a
      // capital sigma always becomes the medial sigma, never the final one.
      ['\u039f\u0394\u039f\u03a3', '\u03bf\u03b4\u03bf\u03c3', true], // ΟΔΟΣ / οδοσ
      ['\u039f\u0394\u039f\u03a3', '\u03bf\u03b4\u03bf\u03c2', false], // ΟΔΟΣ / οδος
      ['\u03bf\u03b4\u03bf\u03c2', '\u03bf\u03b4\u03bf\u03c3', false], // οδος / οδοσ
      // Dotted capital I lowers to a plain "i" (simple mapping), as in PostgreSQL.
      ['\u0130stanbul', 'istanbul', true],
      ['\u0130stanbul', 'i\u0307stanbul', false],
    ])('%j equals %j: %s', (a, b, expected) => {
      expect(TeamName.create(a).equals(TeamName.create(b))).toBe(expected);
    });
  });
});
