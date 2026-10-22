import { InvalidDueDate } from '../errors/task.errors';

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A calendar date without time, `YYYY-MM-DD`. It must exist in the UTC
 * calendar (no `2026-02-30`), and year 0000 is refused like PostgreSQL `date`.
 */
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
    // setUTCFullYear, unlike Date.UTC, does not map years 0–99 to 1900–1999.
    // An impossible date overflows (2026-02-30 → 2026-03-02) and no longer
    // formats back to the input.
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    if (year === 0 || date.toISOString().slice(0, 10) !== raw) {
      throw new InvalidDueDate();
    }
    return new DueDate(raw);
  }

  /** The UTC calendar day of an instant (BR-03.9: "today" is UTC). */
  static todayFrom(now: Date): DueDate {
    return new DueDate(now.toISOString().slice(0, 10));
  }

  isBefore(other: DueDate): boolean {
    // Fixed-width YYYY-MM-DD strings sort chronologically.
    return this.value < other.value;
  }

  equals(other: DueDate): boolean {
    return this.value === other.value;
  }
}
