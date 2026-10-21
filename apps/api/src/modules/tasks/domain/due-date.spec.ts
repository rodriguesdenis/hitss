import { DueDate } from './due-date';
import { InvalidDueDate } from './errors/invalid-due-date.error';

describe('DueDate', () => {
  describe('AC-03.1.5 AC-03.9.3 must be a real calendar date in YYYY-MM-DD form', () => {
    it.each(['2026-10-31', '2020-01-15', '2028-02-29', '2000-02-29'])(
      'accepts %s',
      (raw) => {
        expect(DueDate.create(raw).value).toBe(raw);
      },
    );

    it.each([
      '2026-02-29', // not a leap year
      '2026-02-30', // AC-03.9.3 edit row
      '1900-02-29', // century, not a leap year
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '2026-10-00',
      '31/10/2026',
      '20261031',
      '2026-10-31T10:00:00Z',
      '2026-10-31\n',
      ' 2026-10-31',
      '2026-1-31',
      '+02026-10-31',
      'tomorrow',
      '',
    ])('rejects %j', (raw) => {
      expect(() => DueDate.create(raw)).toThrow(InvalidDueDate);
    });

    it('accepts the years PostgreSQL date can store with four digits', () => {
      expect(DueDate.create('0001-01-01').value).toBe('0001-01-01');
      expect(DueDate.create('9999-12-31').value).toBe('9999-12-31');
      expect(DueDate.create('0099-03-01').value).toBe('0099-03-01');
    });

    it('rejects year 0000, which PostgreSQL date refuses', () => {
      expect(() => DueDate.create('0000-01-01')).toThrow(InvalidDueDate);
    });

    it('reports the "dueDate" field', () => {
      let error: unknown;
      try {
        DueDate.create('tomorrow');
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(InvalidDueDate);
      expect(error).toMatchObject({
        field: 'dueDate',
        message:
          'Due date must be a real calendar date in the form YYYY-MM-DD.',
      });
    });
  });

  describe('todayFrom (UTC calendar day, BR-03.9)', () => {
    it.each([
      ['2026-10-20T00:00:00.000Z', '2026-10-20'],
      ['2026-10-20T23:59:59.999Z', '2026-10-20'],
      ['2026-12-31T23:59:59.999Z', '2026-12-31'],
      ['2028-02-29T12:00:00.000Z', '2028-02-29'],
    ])('%s is %s', (instant, day) => {
      expect(DueDate.todayFrom(new Date(instant)).value).toBe(day);
    });
  });

  describe('isBefore', () => {
    const day = DueDate.create('2026-10-20');

    it.each([
      ['2026-10-19', true],
      ['2026-10-20', false],
      ['2026-10-21', false],
      ['2025-12-31', true],
      ['0999-12-31', true],
    ])('%s is before 2026-10-20: %s', (raw, expected) => {
      expect(DueDate.create(raw).isBefore(day)).toBe(expected);
    });
  });

  it('equals compares the calendar day', () => {
    expect(
      DueDate.create('2026-10-20').equals(DueDate.create('2026-10-20')),
    ).toBe(true);
    expect(
      DueDate.create('2026-10-20').equals(DueDate.create('2026-10-21')),
    ).toBe(false);
  });
});
