import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { DueDate } from '../value-objects/due-date.vo';
import { TaskCreated, TaskDeleted, TaskStatusChanged } from '../task.events';
import { TaskDescription } from '../value-objects/task-description.vo';
import { TaskStatus } from '../value-objects/task-status.vo';
import { TaskTeamIds } from '../value-objects/task-team-ids.vo';
import { TaskTitle } from '../value-objects/task-title.vo';

export interface TaskProps {
  id: string;
  ownerId: string;
  title: TaskTitle;
  description: TaskDescription;
  status: TaskStatus;
  dueDate: DueDate | null;
  teamIds: TaskTeamIds;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TaskEdit {
  title: TaskTitle;
  description: TaskDescription;
  dueDate: DueDate | null;
}

/**
 * Task aggregate root. Each change method returns whether anything changed
 * and then touches `updatedAt`; persistence increments `version` on every
 * write and keeps it as data (last write wins, ADR-0020). A no-op returns
 * `false` and changes nothing (BR-03.12).
 */
export class Task extends AggregateRoot {
  private constructor(private props: TaskProps) {
    super();
  }

  static create(
    p: TaskEdit & {
      id: string;
      ownerId: string;
      status?: TaskStatus;
      teamIds: TaskTeamIds;
      now: Date;
    },
  ): Task {
    const status = p.status ?? TaskStatus.PENDING;
    const task = new Task({
      id: p.id,
      ownerId: p.ownerId,
      title: p.title,
      description: p.description,
      status,
      dueDate: p.dueDate,
      teamIds: p.teamIds,
      completedAt: status === TaskStatus.DONE ? new Date(p.now) : null,
      version: 1,
      createdAt: new Date(p.now),
      updatedAt: new Date(p.now),
      deletedAt: null,
    });
    task.raise(new TaskCreated(p.id, p.ownerId, status, new Date(p.now)));
    return task;
  }

  /** Rebuilds a persisted task; raises no events. */
  static reconstitute(props: TaskProps): Task {
    return new Task({
      ...props,
      completedAt: copyDate(props.completedAt),
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

  get title(): TaskTitle {
    return this.props.title;
  }

  get description(): TaskDescription {
    return this.props.description;
  }

  get status(): TaskStatus {
    return this.props.status;
  }

  get dueDate(): DueDate | null {
    return this.props.dueDate;
  }

  get teamIds(): TaskTeamIds {
    return this.props.teamIds;
  }

  get version(): number {
    return this.props.version;
  }

  // Dates are mutable: copies in and out keep the aggregate's timestamps private.
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

  /** Replaces title, description and due date. */
  edit(p: TaskEdit & { now: Date }): boolean {
    if (
      p.title.equals(this.props.title) &&
      p.description.equals(this.props.description) &&
      (p.dueDate?.value ?? null) === (this.props.dueDate?.value ?? null)
    ) {
      return false;
    }
    this.props = {
      ...this.props,
      title: p.title,
      description: p.description,
      dueDate: p.dueDate,
    };
    this.touch(p.now);
    return true;
  }

  /** Replaces the whole set of teams; the same ids in any order is a no-op. */
  assignTo(teamIds: TaskTeamIds, now: Date): boolean {
    if (teamIds.equals(this.props.teamIds)) {
      return false;
    }
    this.props = { ...this.props, teamIds };
    this.touch(now);
    return true;
  }

  /**
   * Any status may change to any other (BR-03.4). Entering DONE sets the
   * completion time, leaving it clears it (BR-03.5); the same status is a
   * no-op that keeps the original completion time.
   */
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
    this.raise(new TaskStatusChanged(this.props.id, from, to, new Date(now)));
    return true;
  }

  /** Reaction to `TeamDeleted`: a change only if the team was assigned. */
  unassignTeam(teamId: string, now: Date): boolean {
    return this.assignTo(this.props.teamIds.without(teamId), now);
  }

  /** Archives the task and raises `TaskDeleted`; deleting again is a no-op. */
  delete(now: Date): void {
    if (this.props.deletedAt !== null) {
      return;
    }
    this.props = { ...this.props, deletedAt: new Date(now) };
    this.raise(new TaskDeleted(this.props.id, new Date(now)));
  }

  /** Records a change time; the version is incremented by persistence. */
  private touch(now: Date): void {
    this.props = { ...this.props, updatedAt: new Date(now) };
  }
}

function copyDate(date: Date | null): Date | null {
  return date === null ? null : new Date(date);
}
