import { InvalidTaskTitle } from '../errors/task.errors';

const MIN_LENGTH = 3;
const MAX_LENGTH = 120;
const CONTROL_CHARACTER = /\p{Cc}/u;

export class TaskTitle {
  private constructor(readonly value: string) {}

  static create(raw: string): TaskTitle {
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
