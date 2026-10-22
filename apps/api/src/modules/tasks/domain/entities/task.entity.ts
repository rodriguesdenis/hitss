import { InvalidTaskDescription, TooManyTeams } from '../errors/task.errors';
import { DueDate } from '../value-objects/due-date.vo';
import { TaskStatus } from '../value-objects/task-status.vo';
import { TaskTitle } from '../value-objects/task-title.vo';

const DESCRIPTION_MAX_LENGTH = 2000;
const CONTROL_CHARACTER_EXCEPT_LINE_BREAK = /(?![\n\r])\p{Cc}/u;
const MAX_TEAMS_PER_TASK = 10;

export interface TaskProps {
  id: string;
  ownerId: string;
  title: TaskTitle;
  description: string | null;
  status: TaskStatus;
  dueDate: DueDate | null;
  teamIds: readonly string[];
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TaskEdit {
  title: TaskTitle;
  description?: string | null;
  dueDate: DueDate | null;
}

export class Task {
  private constructor(private props: TaskProps) {}

  static create(
    p: TaskEdit & {
      ownerId: string;
      status?: TaskStatus;
      teamIds: readonly string[];
      now: Date;
    },
  ): Task {
    const teamIds = normalizeTeamIds(p.teamIds);
    const status = p.status ?? TaskStatus.PENDING;
    return new Task({
      id: crypto.randomUUID(),
      ownerId: p.ownerId,
      title: p.title,
      description: normalizeDescription(p.description),
      status,
      dueDate: p.dueDate,
      teamIds,
      completedAt: status === TaskStatus.DONE ? new Date(p.now) : null,
      version: 1,
      createdAt: new Date(p.now),
      updatedAt: new Date(p.now),
      deletedAt: null,
    });
  }

  static restore(props: TaskProps): Task {
    return new Task({
      ...props,
      description: normalizeDescription(props.description),
      teamIds: normalizeTeamIds(props.teamIds),
      completedAt: copyDate(props.completedAt),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
      deletedAt: copyDate(props.deletedAt),
    });
  }

  static isOverdue(
    status: TaskStatus,
    dueDate: DueDate | null,
    today: DueDate,
  ): boolean {
    return (
      status !== TaskStatus.DONE && dueDate !== null && dueDate.isBefore(today)
    );
  }

  get id(): string {
    return this.props.id;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get title(): TaskTitle {
    return this.props.title;
  }

  get description(): string | null {
    return this.props.description;
  }

  get status(): TaskStatus {
    return this.props.status;
  }

  get dueDate(): DueDate | null {
    return this.props.dueDate;
  }

  get teamIds(): string[] {
    return [...this.props.teamIds];
  }

  get version(): number {
    return this.props.version;
  }

  get completedAt(): Date | null {
    return copyDate(this.props.completedAt);
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

  isOverdue(today: DueDate): boolean {
    return Task.isOverdue(this.props.status, this.props.dueDate, today);
  }

  edit(p: TaskEdit & { now: Date }): boolean {
    const description = normalizeDescription(p.description);
    if (
      p.title.equals(this.props.title) &&
      description === this.props.description &&
      (p.dueDate?.value ?? null) === (this.props.dueDate?.value ?? null)
    ) {
      return false;
    }
    this.props = {
      ...this.props,
      title: p.title,
      description,
      dueDate: p.dueDate,
    };
    this.touch(p.now);
    return true;
  }

  assignTo(ids: readonly string[], now: Date): boolean {
    const teamIds = normalizeTeamIds(ids);
    const current = this.props.teamIds;
    if (
      teamIds.length === current.length &&
      teamIds.every((id, index) => id === current[index])
    ) {
      return false;
    }
    this.props = { ...this.props, teamIds };
    this.touch(now);
    return true;
  }

  changeStatus(to: TaskStatus, now: Date): boolean {
    const from = this.props.status;
    if (to === from) {
      return false;
    }
    this.props = {
      ...this.props,
      status: to,
      completedAt: to === TaskStatus.DONE ? new Date(now) : null,
    };
    this.touch(now);
    return true;
  }

  delete(now: Date): void {
    if (this.props.deletedAt !== null) {
      return;
    }
    this.props = { ...this.props, deletedAt: new Date(now) };
  }

  private touch(now: Date): void {
    this.props = { ...this.props, updatedAt: new Date(now) };
  }
}

function normalizeDescription(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (CONTROL_CHARACTER_EXCEPT_LINE_BREAK.test(raw)) {
    throw new InvalidTaskDescription();
  }
  const value = raw.trim();
  if (value === '') {
    return null;
  }
  if ([...value].length > DESCRIPTION_MAX_LENGTH) {
    throw new InvalidTaskDescription();
  }
  return value;
}

function normalizeTeamIds(ids: readonly string[]): string[] {
  const distinct = [...new Set(ids)];
  if (distinct.length > MAX_TEAMS_PER_TASK) {
    throw new TooManyTeams(MAX_TEAMS_PER_TASK, distinct.length);
  }
  return distinct.sort();
}

function copyDate(date: Date | null): Date | null {
  return date === null ? null : new Date(date);
}
