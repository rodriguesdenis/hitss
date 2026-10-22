import { SystemClock } from './system-clock';
import { UuidGenerator } from './uuid-generator';

describe('UuidGenerator and SystemClock', () => {
  it('generates distinct UUID v4 ids', () => {
    const ids = new UuidGenerator();
    const first = ids.next();

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(ids.next()).not.toBe(first);
  });

  it('reads the system time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
