import { registerDecorator, ValidationOptions } from 'class-validator';

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = PATTERN.exec(value);
  if (match === null) return false;
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year !== 0 && date.toISOString().slice(0, 10) === value;
}

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
