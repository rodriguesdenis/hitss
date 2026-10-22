import { InvalidTeamDescription } from '../errors/team.errors';
import { ColorHex } from '../value-objects/color-hex.vo';
import { TeamName } from '../value-objects/team-name.vo';

const DESCRIPTION_MAX_LENGTH = 280;
const CONTROL_CHARACTER_EXCEPT_LINE_BREAK = /(?![\n\r])\p{Cc}/u;

export interface TeamProps {
  id: string;
  ownerId: string;
  name: TeamName;
  color: ColorHex;
  /** Trimmed, at most 280 code points, no control characters but line breaks; blank → `null`. */
  description: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TeamValues {
  name: TeamName;
  color: ColorHex;
  /** Raw input; omitted means none (a `PUT` is a full replacement). */
  description?: string | null;
}

/**
 * Team aggregate root. The `version` is incremented by persistence on every
 * write and kept as data (last write wins, ADR-0020); the aggregate only
 * reports whether anything changed.
 * Name uniqueness per owner is enforced by the application and the database.
 */
export class Team {
  private constructor(private props: TeamProps) {}

  /** A new team at version 1, with a fresh id (the global Web Crypto API, no import). */
  static create(p: TeamValues & { ownerId: string; now: Date }): Team {
    return new Team({
      id: crypto.randomUUID(),
      ownerId: p.ownerId,
      name: p.name,
      color: p.color,
      description: normalizeDescription(p.description),
      version: 1,
      createdAt: new Date(p.now),
      updatedAt: new Date(p.now),
      deletedAt: null,
    });
  }

  /** Rebuilds a persisted team; the description is re-validated like on create (ADR-0004). */
  static restore(props: TeamProps): Team {
    return new Team({
      ...props,
      description: normalizeDescription(props.description),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
      deletedAt: copyDate(props.deletedAt),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get name(): TeamName {
    return this.props.name;
  }

  get color(): ColorHex {
    return this.props.color;
  }

  get description(): string | null {
    return this.props.description;
  }

  get version(): number {
    return this.props.version;
  }

  // Dates are mutable: copies in and out keep the aggregate's timestamps private.
  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  get deletedAt(): Date | null {
    return copyDate(this.props.deletedAt);
  }

  /**
   * Full replacement. Returns `false` (and leaves `updatedAt` untouched) when
   * every value is already equal; a letter-case-only rename is a change.
   */
  replace(p: TeamValues & { now: Date }): boolean {
    const description = normalizeDescription(p.description);
    const changed =
      p.name.value !== this.props.name.value ||
      !p.color.equals(this.props.color) ||
      description !== this.props.description;
    if (!changed) {
      return false;
    }
    this.props = {
      ...this.props,
      name: p.name,
      color: p.color,
      description,
      updatedAt: new Date(p.now),
    };
    return true;
  }

  /** Archives the team; deleting again is a no-op. */
  delete(now: Date): void {
    if (this.props.deletedAt !== null) {
      return;
    }
    this.props = { ...this.props, deletedAt: new Date(now) };
  }
}

function normalizeDescription(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  // Checked before trimming: trim() would silently drop a trailing "\t".
  if (CONTROL_CHARACTER_EXCEPT_LINE_BREAK.test(raw)) {
    throw new InvalidTeamDescription();
  }
  const value = raw.trim();
  if (value === '') {
    return null;
  }
  if ([...value].length > DESCRIPTION_MAX_LENGTH) {
    throw new InvalidTeamDescription();
  }
  return value;
}

function copyDate(date: Date | null): Date | null {
  return date === null ? null : new Date(date);
}
