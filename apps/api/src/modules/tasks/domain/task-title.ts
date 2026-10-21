import { InvalidTaskTitle } from './errors/invalid-task-title.error';

const MIN_LENGTH = 3;
const MAX_LENGTH = 120;
const CONTROL_CHARACTER = /\p{Cc}/u;

/** A task's title: trimmed, 3–120 code points, no control characters. */
export class TaskTitle {
  private constructor(readonly value: string) {}

  static create(raw: string): TaskTitle {
    // Checked before trimming: trim() would silently drop a trailing "\n".
    if (CONTROL_CHARACTER.test(raw)) {
      throw new InvalidTaskTitle();
    }
    const value = raw.trim();
    const length = [...value].length;
    if (length < MIN_LENGTH || length > MAX_LENGTH) {
      throw new InvalidTaskTitle();
    }
    return new TaskTitle(value);
  }

  equals(other: TaskTitle): boolean {
    return this.value === other.value;
  }
}
