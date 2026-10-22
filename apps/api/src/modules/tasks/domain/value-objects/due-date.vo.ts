import { InvalidDueDate } from '../errors/task.errors';

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class DueDate {
  private constructor(readonly value: string) {}

  static create(raw: string): DueDate {
    const match = PATTERN.exec(raw);
    if (match === null) {
      throw new InvalidDueDate();
    }
    const [year, month, day] = match.slice(1).map(Number) as [
      number,
      number,
      number,
    ];
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    if (year === 0 || date.toISOString().slice(0, 10) !== raw) {
      throw new InvalidDueDate();
    }
    return new DueDate(raw);
  }

  static todayFrom(now: Date): DueDate {
    return new DueDate(now.toISOString().slice(0, 10));
  }

  isBefore(other: DueDate): boolean {
    return this.value < other.value;
  }

  equals(other: DueDate): boolean {
    return this.value === other.value;
  }
}
