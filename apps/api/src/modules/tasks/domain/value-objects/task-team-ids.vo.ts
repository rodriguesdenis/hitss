import { TooManyTeams } from '../errors/task.errors';

export const MAX_TEAMS_PER_TASK = 10;

/**
 * The teams a task is assigned to: a set of at most 10 distinct ids. The
 * caller (DTO) rejects duplicates and malformed ids; here repeated ids count
 * once. Whether the ids exist is checked by the application (`UnknownTeams`).
 */
export class TaskTeamIds {
  private constructor(private readonly ids: readonly string[]) {}

  static of(ids: Iterable<string>): TaskTeamIds {
    const distinct = [...new Set(ids)];
    if (distinct.length > MAX_TEAMS_PER_TASK) {
      throw new TooManyTeams(MAX_TEAMS_PER_TASK, distinct.length);
    }
    return new TaskTeamIds(distinct.sort());
  }

  get values(): string[] {
    return [...this.ids];
  }

  without(id: string): TaskTeamIds {
    return new TaskTeamIds(this.ids.filter((other) => other !== id));
  }

  /** Order-insensitive: the ids are kept sorted. */
  equals(other: TaskTeamIds): boolean {
    return (
      this.ids.length === other.ids.length &&
      this.ids.every((id, index) => id === other.ids[index])
    );
  }
}
