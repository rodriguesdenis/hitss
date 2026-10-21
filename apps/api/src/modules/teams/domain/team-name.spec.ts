import { InvalidTeamName } from './errors/invalid-team-name.error';
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

  describe('equals (case-insensitive)', () => {
    it.each([
      ['Mobile', 'MOBILE', true],
      ['Mobile', 'mobile', true],
      ['\u03a9mega', '\u03c9mega', true], // capital / small omega
      ['\u00c9quipe', '\u00e9quipe', true], // capital / small e acute
      ['\u00c9quipe', 'Equipe', false], // accents are significant
      ['Mobile', 'Backend', false],
    ])('%j equals %j: %s', (a, b, expected) => {
      expect(TeamName.create(a).equals(TeamName.create(b))).toBe(expected);
    });
  });
});
