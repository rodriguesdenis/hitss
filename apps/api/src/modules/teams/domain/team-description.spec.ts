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
        message: 'Description must be at most 280 characters long.',
      });
    });
  });

  describe('AC-02.1.4 blank descriptions become no description', () => {
    it.each([undefined, null, '', '    ', '\n\t '])('%j → null', (raw) => {
      expect(TeamDescription.create(raw).value).toBeNull();
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
