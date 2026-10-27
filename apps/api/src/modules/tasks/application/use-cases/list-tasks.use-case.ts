import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import type { Page } from '../../../../shared/application/page';
import {
  ListTasksCriteria,
  TaskReadModel,
  TaskView,
} from '../interfaces/task-read-model.interface';
import { TeamDirectory } from '../interfaces/team-directory.interface';
import { toTaskView } from './task-view';

export interface ListTasksInput {
  readonly ownerId: string;
  readonly criteria: ListTasksCriteria;
}

@Injectable()
export class ListTasksUseCase {
  constructor(
    private readonly readModel: TaskReadModel,
    private readonly teams: TeamDirectory,
    private readonly clock: Clock,
  ) {}

  async execute({
    ownerId,
    criteria,
  }: ListTasksInput): Promise<Page<TaskView>> {
    const today = DueDate.todayFrom(this.clock.now());
    if (
      criteria.teamId !== undefined &&
      (await this.teams.findMissing(ownerId, [criteria.teamId])).length > 0
    ) {
      return { items: [], total: 0 };
    }
    const page = await this.readModel.list(ownerId, criteria);
    const teamIds = [...new Set(page.items.flatMap((task) => task.teamIds))];
    const teams = await this.teams.summaries(ownerId, teamIds);
    return {
      items: page.items.map((task) => toTaskView(task, teams, today)),
      total: page.total,
    };
  }
}
