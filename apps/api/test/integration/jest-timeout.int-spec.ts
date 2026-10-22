import { effectiveTimeout } from '../support/effective-timeout';
import { DATABASE_TEST_TIMEOUT } from '../support/timeouts';

describe('effective Jest timeout per project', () => {
  it('integration project: tests run with the database timeout, not the 5 s default', () => {
    expect(effectiveTimeout()).toBe(DATABASE_TEST_TIMEOUT);
  });
});
