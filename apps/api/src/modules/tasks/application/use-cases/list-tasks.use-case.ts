import { Injectable } from '@nestjs/common';
import type { Page } from '../../../../shared/application/page';
import { Clock } from '../../../../shared/domain/clock';
import { TeamLookup } from '../../../teams/team-lookup.service';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import { ListTasksCriteria, TaskReadModel } from '../ports/task.read-model';
import { assembleTaskView } from '../views/task-view.assembler';
import type { TaskView } from '../views/task.view';

export interface ListTasksInput {
  readonly ownerId: string;
  readonly criteria: ListTasksCriteria;
}

/**
 * A team filter that is not one of the owner's live teams (unknown, deleted, foreign) is an empty
 * page, and the tasks are not queried (AC-03.3.2). Otherwise one read-model call for the page and
 * its total, and one TeamLookup call for every team on the page, so the query count does not grow
 * with the page size.
 */
@Injectable()
export class ListTasksUseCase {
  constructor(
    private readonly readModel: TaskReadModel,
    private readonly teams: TeamLookup,
    private readonly clock: Clock,
  ) {}

  async execute({
    ownerId,
    criteria,
  }: ListTasksInput): Promise<Page<TaskView>> {
    if (
      criteria.teamId !== undefined &&
      (await this.teams.findMissing(ownerId, [criteria.teamId])).length > 0
    ) {
      return { items: [], total: 0 };
    }
    const { items, total } = await this.readModel.list(ownerId, criteria);
    const teamIds = [...new Set(items.flatMap((record) => record.teamIds))];
    const summaries = await this.teams.summaries(ownerId, teamIds);
    const today = DueDate.todayFrom(this.clock.now());
    return {
      items: items.map((record) => assembleTaskView(record, summaries, today)),
      total,
    };
  }
}
