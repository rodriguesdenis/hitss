import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TeamLookup } from '../../../teams/team-lookup.service';
import { Task } from '../../domain/entities/task.entity';
import { UnknownTeams } from '../../domain/errors/task.errors';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import type { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { TaskTitle } from '../../domain/value-objects/task-title.vo';

export interface CreateTaskInput {
  readonly ownerId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly status?: TaskStatus;
  readonly dueDate?: string | null;
  readonly teamIds?: readonly string[];
}

@Injectable()
export class CreateTaskUseCase {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly teams: TeamLookup,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateTaskInput): Promise<string> {
    const task = Task.create({
      ownerId: input.ownerId,
      title: TaskTitle.create(input.title),
      description: input.description,
      status: input.status,
      dueDate: input.dueDate ? DueDate.create(input.dueDate) : null,
      teamIds: input.teamIds ?? [],
      now: this.clock.now(),
    });
    const teamIds = task.teamIds;
    const unknown = (missing: string[]) => new UnknownTeams(missing);
    await this.teams.assertAllLive(input.ownerId, teamIds, unknown);
    try {
      await this.tasks.insert(task);
    } catch (error) {
      if (error instanceof UnknownTeams && error.teamIds.length === 0) {
        await this.teams.assertAllLive(input.ownerId, teamIds, unknown);
      }
      throw error;
    }
    return task.id;
  }
}
