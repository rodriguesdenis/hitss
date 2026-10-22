import { InvalidTeamName } from '../errors/team.errors';

const MIN_LENGTH = 2;
const MAX_LENGTH = 50;
const CONTROL_CHARACTER = /\p{Cc}/u;

export class TeamName {
  private constructor(readonly value: string) {}

  static create(raw: string): TeamName {
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

  equals(other: TeamName): boolean {
    return lowerEachCodePoint(this.value) === lowerEachCodePoint(other.value);
  }
}

function lowerEachCodePoint(text: string): string {
  const lowered = Array.from(text, (c) =>
    c === '\u0130' ? 'i' : c.toLowerCase(),
  );
  return lowered.join('');
}
