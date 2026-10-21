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

  /**
   * Case-insensitive, with the same semantics as the `lower(name)` unique
   * index: each code point is lowercased on its own (simple case mapping), so
   * a capital sigma never becomes a final sigma as `String#toLowerCase` does.
   */
  equals(other: TeamName): boolean {
    return lowerEachCodePoint(this.value) === lowerEachCodePoint(other.value);
  }
}

function lowerEachCodePoint(text: string): string {
  // U+0130 (capital I with dot) is the only code point whose full lowercase
  // mapping ("i" + U+0307) differs from its simple one ("i").
  const lowered = Array.from(text, (c) =>
    c === '\u0130' ? 'i' : c.toLowerCase(),
  );
  return lowered.join('');
}
