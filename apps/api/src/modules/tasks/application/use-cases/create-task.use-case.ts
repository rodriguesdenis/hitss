import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TeamLookup } from '../../../teams/team-lookup.service';
import { Task } from '../../domain/entities/task.entity';
import { UnknownTeams } from '../../domain/errors/task.errors';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import { TaskDescription } from '../../domain/value-objects/task-description.vo';
import type { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { TaskTeamIds } from '../../domain/value-objects/task-team-ids.vo';
import { TaskTitle } from '../../domain/value-objects/task-title.vo';

export interface CreateTaskInput {
  readonly ownerId: string;
  /** Already trimmed by the DTO. */
  readonly title: string;
  readonly description?: string | null;
  readonly status?: TaskStatus;
  readonly dueDate?: string | null;
  readonly teamIds?: readonly string[];
}

/**
 * Builds the value objects (the team count first, BR-03.8), rejects teams that are not the
 * owner's live teams (foreign, deleted and never-existing alike, AC-03.1.6, AC-03.12.3) and
 * inserts the task at version 1. Every check runs before the insert, so nothing is written on any
 * error. Returns the new id; the controller reads the task back through GetTaskUseCase.
 */
@Injectable()
export class CreateTaskUseCase {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly teams: TeamLookup,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateTaskInput): Promise<string> {
    const teamIds = TaskTeamIds.of(input.teamIds ?? []);
    const task = Task.create({
      ownerId: input.ownerId,
      title: TaskTitle.create(input.title),
      description: TaskDescription.create(input.description),
      status: input.status,
      dueDate: input.dueDate ? DueDate.create(input.dueDate) : null,
      teamIds,
      now: this.clock.now(),
    });
    const unknown = (missing: string[]) => new UnknownTeams(missing);
    await this.teams.assertAllLive(input.ownerId, teamIds.values, unknown);
    try {
      await this.tasks.insert(task);
    } catch (error) {
      // A team deleted after the check: the FK violation carries no ids, so ask again (AC-03.1.6).
      if (error instanceof UnknownTeams && error.teamIds.length === 0) {
        await this.teams.assertAllLive(input.ownerId, teamIds.values, unknown);
      }
      throw error;
    }
    return task.id;
  }
}
