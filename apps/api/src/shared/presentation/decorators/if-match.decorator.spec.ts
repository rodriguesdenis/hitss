import { ExpectedVersion } from '../../domain/expected-version';
import { parseIfMatch } from './if-match.decorator';

describe('parseIfMatch', () => {
  it.each([
    ['W/"3"', ExpectedVersion.exact(3)],
    ['"3"', ExpectedVersion.exact(3)],
    ['  W/"12"  ', ExpectedVersion.exact(12)],
    ['*', ExpectedVersion.any()],
    [undefined, ExpectedVersion.any()],
  ])('reads %j as %j', (header, expected) => {
    expect(parseIfMatch(header)).toEqual(expected);
  });

  it.each([
    'abc',
    'W/"-1"',
    '1',
    'garbage',
    '"0"',
    'W/"1.5"',
    '"3", "4"',
    'w/"3"',
    '',
    '"01"',
  ])('treats %j as unmatchable (412 after the 404 check)', (header) => {
    expect(parseIfMatch(header)).toEqual(ExpectedVersion.unmatchable());
  });

  it('a repeated header is unmatchable', () => {
    expect(parseIfMatch(['"1"', '"2"'])).toEqual(ExpectedVersion.unmatchable());
  });
});
