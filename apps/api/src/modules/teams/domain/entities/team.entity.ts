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
  description: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TeamValues {
  name: TeamName;
  color: ColorHex;
  description?: string | null;
}

export class Team {
  private constructor(private props: TeamProps) {}

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

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  get deletedAt(): Date | null {
    return copyDate(this.props.deletedAt);
  }

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
