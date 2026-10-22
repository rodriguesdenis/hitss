import { registerDecorator, ValidationOptions } from 'class-validator';

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `YYYY-MM-DD` that exists in the UTC calendar (no `2026-02-30`), year 0000 refused like
 * PostgreSQL `date`. The same rule as the tasks DueDate value object, which re-checks it.
 */
export function isCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = PATTERN.exec(value);
  if (match === null) return false;
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  // setUTCFullYear, unlike Date.UTC, does not map years 0–99 to 1900–1999; an impossible date
  // overflows (2026-02-30 → 2026-03-02) and no longer formats back to the input.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year !== 0 && date.toISOString().slice(0, 10) === value;
}

/** class-validator decorator for {@link isCalendarDate}. */
export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: ({ property }) =>
          `${property} must be a real calendar date in the form YYYY-MM-DD`,
        ...options,
      },
      validator: { validate: isCalendarDate },
    });
  };
}
