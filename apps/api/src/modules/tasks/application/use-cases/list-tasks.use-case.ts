import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TeamLookup } from '../../../teams/team-lookup.service';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import {
  ListTasksCriteria,
  TaskPageView,
  TaskReadModel,
} from '../ports/task.read-model';

export interface ListTasksInput {
  readonly ownerId: string;
  readonly criteria: ListTasksCriteria;
}

@Injectable()
export class ListTasksUseCase {
  constructor(
    private readonly readModel: TaskReadModel,
    private readonly teams: TeamLookup,
    private readonly clock: Clock,
  ) {}

  async execute({ ownerId, criteria }: ListTasksInput): Promise<TaskPageView> {
    const today = DueDate.todayFrom(this.clock.now());
    if (
      criteria.teamId !== undefined &&
      (await this.teams.findMissing(ownerId, [criteria.teamId])).length > 0
    ) {
      return { page: { items: [], total: 0 }, teams: [], today };
    }
    const page = await this.readModel.list(ownerId, criteria);
    const teamIds = [...new Set(page.items.flatMap((task) => task.teamIds))];
    return {
      page,
      teams: await this.teams.summaries(ownerId, teamIds),
      today,
    };
  }
}
