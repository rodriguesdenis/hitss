import { InvalidTeamDescription } from '../errors/team.errors';

const MAX_LENGTH = 280;
const CONTROL_CHARACTER_EXCEPT_LINE_BREAK = /(?![\n\r])\p{Cc}/u;

/**
 * A team's optional description: trimmed, at most 280 code points, no control
 * characters other than line breaks; blank → `null`.
 */
export class TeamDescription {
  private constructor(readonly value: string | null) {}

  static create(raw?: string | null): TeamDescription {
    if (raw === undefined || raw === null) {
      return new TeamDescription(null);
    }
    // Checked before trimming: trim() would silently drop a trailing "\t".
    if (CONTROL_CHARACTER_EXCEPT_LINE_BREAK.test(raw)) {
      throw new InvalidTeamDescription();
    }
    const value = raw.trim();
    if (value === '') {
      return new TeamDescription(null);
    }
    if ([...value].length > MAX_LENGTH) {
      throw new InvalidTeamDescription();
    }
    return new TeamDescription(value);
  }

  equals(other: TeamDescription): boolean {
    return this.value === other.value;
  }
}
