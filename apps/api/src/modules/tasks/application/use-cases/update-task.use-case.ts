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
  readonly title: string;
  readonly status: TaskStatus;
  readonly teamIds: readonly string[];
  readonly description?: string | null;
  readonly dueDate?: string | null;
}

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
    await this.teams.assertAllLive(ownerId, teamIds, unknown);

    if (!changes.includes(true)) {
      return;
    }
    try {
      await this.tasks.update(task);
    } catch (error) {
      if (error instanceof UnknownTeams && error.teamIds.length === 0) {
        await this.teams.assertAllLive(ownerId, teamIds, unknown);
      }
      throw error;
    }
  }
}
