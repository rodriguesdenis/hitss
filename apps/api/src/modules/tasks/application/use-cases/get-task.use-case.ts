import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TaskNotFound } from '../../domain/errors/task.errors';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import {
  TaskReadModel,
  TaskView,
} from '../interfaces/task-read-model.interface';
import { TeamDirectory } from '../interfaces/team-directory.interface';
import { toTaskView } from './task-view';

export interface GetTaskInput {
  readonly ownerId: string;
  readonly id: string;
}

@Injectable()
export class GetTaskUseCase {
  constructor(
    private readonly readModel: TaskReadModel,
    private readonly teams: TeamDirectory,
    private readonly clock: Clock,
  ) {}

  async execute({ ownerId, id }: GetTaskInput): Promise<TaskView> {
    const task = await this.readModel.findById(ownerId, id);
    if (!task) {
      throw new TaskNotFound();
    }
    return toTaskView(
      task,
      await this.teams.summaries(ownerId, task.teamIds),
      DueDate.todayFrom(this.clock.now()),
    );
  }
}
