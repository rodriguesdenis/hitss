import { ExpectedVersion, matchesVersion } from './expected-version';

describe('ExpectedVersion', () => {
  it('builds the three kinds', () => {
    expect(ExpectedVersion.any()).toEqual({ kind: 'any' });
    expect(ExpectedVersion.exact(3)).toEqual({ kind: 'exact', version: 3 });
    expect(ExpectedVersion.unmatchable()).toEqual({ kind: 'unmatchable' });
  });

  describe('matchesVersion', () => {
    it('AC-02.9.4 any matches every current version', () => {
      expect(matchesVersion(ExpectedVersion.any(), 1)).toBe(true);
      expect(matchesVersion(ExpectedVersion.any(), 42)).toBe(true);
    });

    it('AC-02.9.1 exact matches the same version', () => {
      expect(matchesVersion(ExpectedVersion.exact(2), 2)).toBe(true);
    });

    it('AC-02.9.2 exact does not match a newer or older version', () => {
      expect(matchesVersion(ExpectedVersion.exact(1), 2)).toBe(false);
      expect(matchesVersion(ExpectedVersion.exact(3), 2)).toBe(false);
    });

    it('AC-02.9.6 unmatchable never matches', () => {
      expect(matchesVersion(ExpectedVersion.unmatchable(), 1)).toBe(false);
    });
  });
});
