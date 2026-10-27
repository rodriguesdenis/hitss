import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { Task } from '../../domain/entities/task.entity';
import { UnknownTeams } from '../../domain/errors/task.errors';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import type { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { TaskTitle } from '../../domain/value-objects/task-title.vo';
import type { TaskView } from '../interfaces/task-read-model.interface';
import { TeamDirectory } from '../interfaces/team-directory.interface';
import { GetTaskUseCase } from './get-task.use-case';

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
    private readonly teams: TeamDirectory,
    private readonly clock: Clock,
    private readonly getTask: GetTaskUseCase,
  ) {}

  async execute(input: CreateTaskInput): Promise<TaskView> {
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
    return this.getTask.execute({ ownerId: input.ownerId, id: task.id });
  }
}
