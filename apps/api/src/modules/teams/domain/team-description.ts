import { InvalidTeamDescription } from './errors/invalid-team-description.error';

const MAX_LENGTH = 280;

/** A team's optional description: trimmed, at most 280 code points; blank → `null`. */
export class TeamDescription {
  private constructor(readonly value: string | null) {}

  static create(raw?: string | null): TeamDescription {
    const value = raw?.trim() ?? '';
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
