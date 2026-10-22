import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TeamLookup } from '../../../teams/team-lookup.service';
import { TaskNotFound, UnknownTeams } from '../../domain/errors/task.errors';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import { TaskDescription } from '../../domain/value-objects/task-description.vo';
import type { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { TaskTeamIds } from '../../domain/value-objects/task-team-ids.vo';
import { TaskTitle } from '../../domain/value-objects/task-title.vo';
import { preciseUnknownTeams } from './shared/precise-unknown-teams';

export interface UpdateTaskInput {
  readonly ownerId: string;
  readonly id: string;
  /** Already trimmed by the DTO. */
  readonly title: string;
  readonly status: TaskStatus;
  readonly teamIds: readonly string[];
  /** Omitted (`undefined`) clears it (AC-03.9.2). */
  readonly description?: string | null;
  readonly dueDate?: string | null;
}

/**
 * Full replacement (`PUT`):
 * 1. Load the owner's active task; unknown, foreign or deleted → TaskNotFound. Not found wins
 *    over every other error.
 * 2. The create checks: the team count first (TooManyTeams), the value objects, then
 *    UnknownTeams for ids that are not the owner's live teams.
 * 3. `edit`, `assignTo` and `changeStatus` all run, then one write (version + 1) unless nothing
 *    changed: an identical replacement (team order ignored) is a no-op (AC-03.9.5).
 * Last write wins (ADR-0020).
 */
@Injectable()
export class UpdateTaskUseCase {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly teams: TeamLookup,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateTaskInput): Promise<void> {
    const { ownerId, id } = input;
    const task = await this.tasks.findById(ownerId, id);
    if (!task) {
      throw new TaskNotFound();
    }
    const teamIds = TaskTeamIds.of(input.teamIds);
    const fields = {
      title: TaskTitle.create(input.title),
      description: TaskDescription.create(input.description),
      dueDate: input.dueDate ? DueDate.create(input.dueDate) : null,
    };
    const missing = await this.teams.findMissing(ownerId, teamIds.values);
    if (missing.length > 0) {
      throw new UnknownTeams(missing);
    }

    const now = this.clock.now();
    // Each method touches updatedAt only when it changes something; no short-circuit, all run.
    const changes = [
      task.edit({ ...fields, now }),
      task.assignTo(teamIds, now),
      task.changeStatus(input.status, now),
    ];
    if (!changes.includes(true)) {
      return;
    }
    try {
      await this.tasks.update(task);
    } catch (error) {
      throw await preciseUnknownTeams(
        error,
        this.teams,
        ownerId,
        teamIds.values,
      );
    }
  }
}
