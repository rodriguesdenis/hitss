import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TeamLookup } from '../../../teams/team-lookup.service';
import { TaskNotFound } from '../../domain/errors/task.errors';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import { TaskReadModel, TaskView } from '../ports/task.read-model';

export interface GetTaskInput {
  readonly ownerId: string;
  readonly id: string;
}

@Injectable()
export class GetTaskUseCase {
  constructor(
    private readonly readModel: TaskReadModel,
    private readonly teams: TeamLookup,
    private readonly clock: Clock,
  ) {}

  async execute({ ownerId, id }: GetTaskInput): Promise<TaskView> {
    const task = await this.readModel.findById(ownerId, id);
    if (!task) {
      throw new TaskNotFound();
    }
    return {
      task,
      teams: await this.teams.summaries(ownerId, task.teamIds),
      today: DueDate.todayFrom(this.clock.now()),
    };
  }
}
