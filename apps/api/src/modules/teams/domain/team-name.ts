import { InvalidTeamName } from './errors/invalid-team-name.error';

const MIN_LENGTH = 2;
const MAX_LENGTH = 50;
const CONTROL_CHARACTER = /\p{Cc}/u;

/** A team's name: trimmed, 2–50 code points, no control characters. */
export class TeamName {
  private constructor(readonly value: string) {}

  static create(raw: string): TeamName {
    // Checked before trimming: trim() would silently drop a trailing "\r" or "\n".
    if (CONTROL_CHARACTER.test(raw)) {
      throw new InvalidTeamName();
    }
    const value = raw.trim();
    const length = [...value].length;
    if (length < MIN_LENGTH || length > MAX_LENGTH) {
      throw new InvalidTeamName();
    }
    return new TeamName(value);
  }

  /** Case-insensitive, as names are unique per owner regardless of letter case. */
  equals(other: TeamName): boolean {
    return this.value.toLowerCase() === other.value.toLowerCase();
  }
}
