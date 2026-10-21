import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { ConcurrencyConflict } from '../../../shared/domain/domain-error';
import {
  ExpectedVersion,
  matchesVersion,
} from '../../../shared/domain/expected-version';
import { ColorHex } from './color-hex';
import { TeamDeleted } from './events/team-deleted.event';
import { TeamDescription } from './team-description';
import { TeamName } from './team-name';

export interface TeamProps {
  id: string;
  ownerId: string;
  name: TeamName;
  color: ColorHex;
  description: TeamDescription;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TeamValues {
  name: TeamName;
  color: ColorHex;
  description: TeamDescription;
}

/**
 * Team aggregate root. The `version` is incremented by persistence on every
 * write (ADR-0015); the aggregate only reports whether anything changed.
 * Name uniqueness per owner is enforced by the application and the database.
 */
export class Team extends AggregateRoot {
  private constructor(private props: TeamProps) {
    super();
  }

  static create(
    p: TeamValues & { id: string; ownerId: string; now: Date },
  ): Team {
    return new Team({
      id: p.id,
      ownerId: p.ownerId,
      name: p.name,
      color: p.color,
      description: p.description,
      version: 1,
      createdAt: p.now,
      updatedAt: p.now,
      deletedAt: null,
    });
  }

  /** Rebuilds a persisted team; raises no events. */
  static reconstitute(props: TeamProps): Team {
    return new Team({ ...props });
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

  get description(): TeamDescription {
    return this.props.description;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  /**
   * Full replacement. Returns `false` (and leaves `updatedAt` untouched) when
   * every value is already equal; a letter-case-only rename is a change.
   */
  replace(p: TeamValues & { now: Date }): boolean {
    const changed =
      p.name.value !== this.props.name.value ||
      !p.color.equals(this.props.color) ||
      !p.description.equals(this.props.description);
    if (!changed) {
      return false;
    }
    this.props = {
      ...this.props,
      name: p.name,
      color: p.color,
      description: p.description,
      updatedAt: p.now,
    };
    return true;
  }

  /** Archives the team and raises `TeamDeleted`; deleting again is a no-op. */
  delete(now: Date): void {
    if (this.props.deletedAt !== null) {
      return;
    }
    this.props = { ...this.props, deletedAt: now };
    this.raise(new TeamDeleted(this.props.id, this.props.ownerId, now));
  }

  assertVersion(expected: ExpectedVersion): void {
    if (!matchesVersion(expected, this.props.version)) {
      throw new ConcurrencyConflict(this.props.version);
    }
  }
}
