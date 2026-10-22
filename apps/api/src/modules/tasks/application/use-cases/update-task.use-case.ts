import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TeamLookup } from '../../../teams/team-lookup.service';
import { TaskNotFound, UnknownTeams } from '../../domain/errors/task.errors';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import type { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { TaskTitle } from '../../domain/value-objects/task-title.vo';

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
 * 2. `assignTo` (the team count first, TooManyTeams), `edit` and `changeStatus` all run on the
 *    loaded aggregate, then UnknownTeams for ids that are not the owner's live teams.
 * 3. One write (version + 1) unless nothing changed: an identical replacement (team order
 *    ignored) is a no-op (AC-03.9.5).
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
    const now = this.clock.now();
    // Each method touches updatedAt only when it changes something; no short-circuit, all run.
    // assignTo first: the team count (TooManyTeams) precedes every other check (BR-03.8).
    const changes = [
      task.assignTo(input.teamIds, now),
      task.edit({
        title: TaskTitle.create(input.title),
        description: input.description,
        dueDate: input.dueDate ? DueDate.create(input.dueDate) : null,
        now,
      }),
      task.changeStatus(input.status, now),
    ];
    const teamIds = task.teamIds;
    const unknown = (missing: string[]) => new UnknownTeams(missing);
    // Nothing is written yet, so an unknown team leaves the stored task unchanged.
    await this.teams.assertAllLive(ownerId, teamIds, unknown);

    if (!changes.includes(true)) {
      return;
    }
    try {
      await this.tasks.update(task);
    } catch (error) {
      // A team deleted after the check: the FK violation carries no ids, so ask again (AC-03.1.6).
      if (error instanceof UnknownTeams && error.teamIds.length === 0) {
        await this.teams.assertAllLive(ownerId, teamIds, unknown);
      }
      throw error;
    }
  }
}
