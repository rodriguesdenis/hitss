import { effectiveTimeout, JEST_DEFAULT_TIMEOUT } from './effective-timeout';

describe('effective Jest timeout per project', () => {
  it('unit project: tests keep the default timeout, so a slow unit test fails fast', () => {
    expect(effectiveTimeout()).toBe(JEST_DEFAULT_TIMEOUT);
  });
});
