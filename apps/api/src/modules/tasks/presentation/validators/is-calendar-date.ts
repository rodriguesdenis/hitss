import { registerDecorator, ValidationOptions } from 'class-validator';
import { DueDate } from '../../domain/value-objects/due-date';

/** A real `YYYY-MM-DD` calendar date, judged by the DueDate value object (no `2026-02-30`). */
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
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          try {
            DueDate.create(value);
            return true;
          } catch {
            return false;
          }
        },
      },
    });
  };
}
