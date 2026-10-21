import { InvalidTaskDescription } from './errors/invalid-task-description.error';

const MAX_LENGTH = 2000;
const CONTROL_CHARACTER_EXCEPT_LINE_BREAK = /(?![\n\r])\p{Cc}/u;

/**
 * A task's optional description: trimmed, at most 2000 code points, no control
 * characters other than line breaks; blank → `null`.
 */
export class TaskDescription {
  private constructor(readonly value: string | null) {}

  static create(raw?: string | null): TaskDescription {
    if (raw === undefined || raw === null) {
      return new TaskDescription(null);
    }
    // Checked before trimming: trim() would silently drop a trailing "\t".
    if (CONTROL_CHARACTER_EXCEPT_LINE_BREAK.test(raw)) {
      throw new InvalidTaskDescription();
    }
    const value = raw.trim();
    if (value === '') {
      return new TaskDescription(null);
    }
    if ([...value].length > MAX_LENGTH) {
      throw new InvalidTaskDescription();
    }
    return new TaskDescription(value);
  }

  equals(other: TaskDescription): boolean {
    return this.value === other.value;
  }
}
