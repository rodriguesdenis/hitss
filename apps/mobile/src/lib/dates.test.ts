import {
  formatLongDate,
  formatShortDate,
  isPastDate,
  parseCalendarDate,
  toCalendarDate,
} from './dates';

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe(`calendar dates in ${zone}`, () => {
  it('runs in the zone requested by TZ', () => {
    expect(zone).toBe(process.env.TZ ?? zone);
  });

  it('parses YYYY-MM-DD as the local calendar day', () => {
    const date = parseCalendarDate('2026-10-31');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
      2026, 9, 31,
    ]);
  });

  it('round-trips through toCalendarDate', () => {
    expect(toCalendarDate(parseCalendarDate('2026-01-01'))).toBe('2026-01-01');
    expect(toCalendarDate(parseCalendarDate('2028-02-29'))).toBe('2028-02-29');
  });

  it('formats lists as "31 de out."', () => {
    expect(formatShortDate('2026-10-31')).toBe('31 de out.');
  });

  it('formats the detail with the weekday', () => {
    expect(formatLongDate('2026-10-31')).toBe('sábado, 31 de outubro de 2026');
  });

  it('compares against the local today', () => {
    const today = new Date(2026, 9, 25, 23, 59);
    expect(isPastDate('2026-10-24', today)).toBe(true);
    expect(isPastDate('2026-10-25', today)).toBe(false);
    expect(isPastDate('2026-10-26', today)).toBe(false);
  });
});

describe('parseCalendarDate', () => {
  it.each(['2026-02-30', '2026-13-01', '31/10/2026', '2026-10-31T00:00:00Z'])(
    'rejects %s',
    (value) => {
      expect(() => parseCalendarDate(value)).toThrow(
        `Invalid calendar date: ${value}`,
      );
    },
  );
});
