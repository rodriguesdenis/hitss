import { InvalidTeamName } from '../team.errors';

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
   * Case-insensitive comparison approximating the database. The authority for
   * name uniqueness is PostgreSQL's `lower(name)` unique index
   * (teams_owner_id_lower_name_key); repositories check names with SQL
   * `lower()`, not with this method. Like `lower()`, each code point is
   * lowercased on its own (simple case mapping), so a capital sigma never
   * becomes a final sigma as `String#toLowerCase` does, and U+0130 maps to a
   * plain "i". Known residual on the libc/musl image: code points `lower()`
   * leaves unchanged (circled letters, Unicode 14+) compare equal here only;
   * see test/integration/team-name-collation.int-spec.ts.
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
