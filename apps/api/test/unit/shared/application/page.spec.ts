import { hasNextPage } from '../../../../src/shared/application/page';

describe('hasNextPage (BR-02.10: offset + returned < total)', () => {
  it.each([
    [
      'AC-02.2.3 first page of 25 by 10',
      { limit: 10, offset: 0 },
      10,
      25,
      true,
    ],
    [
      'AC-02.2.3 second page of 25 by 10',
      { limit: 10, offset: 10 },
      10,
      25,
      true,
    ],
    [
      'AC-02.2.3 last page of 25 by 10',
      { limit: 10, offset: 20 },
      5,
      25,
      false,
    ],
    [
      'AC-02.2.4 offset beyond the total',
      { limit: 10, offset: 3 },
      0,
      3,
      false,
    ],
    ['AC-02.2.6 no rows at all', { limit: 20, offset: 0 }, 0, 0, false],
    ['an exact last page', { limit: 5, offset: 5 }, 5, 10, false],
  ])('%s → %s', (_label, request, returned, total, expected) => {
    expect(hasNextPage(request, returned, total)).toBe(expected);
  });
});
