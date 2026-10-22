import {
  containsPattern,
  escapeLike,
} from '../../../../../src/shared/infrastructure/sql/like';

describe('escapeLike', () => {
  it('AC-02.3.3 makes % and _ literal, and escapes the escape character first', () => {
    expect(escapeLike('50%')).toBe('50\\%');
    expect(escapeLike('Team_A')).toBe('Team\\_A');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
    expect(escapeLike('\\%_')).toBe('\\\\\\%\\_');
  });

  it('leaves every other character alone', () => {
    expect(escapeLike("Mobile QA 'ß' 🚀")).toBe("Mobile QA 'ß' 🚀");
  });
});

describe('containsPattern', () => {
  it('wraps the escaped term for a substring match (ESCAPE backslash)', () => {
    expect(containsPattern('50%')).toBe('%50\\%%');
  });
});
