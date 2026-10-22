import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import type { Page } from '../../../../../shared/application/page';
import { Traced } from '../../../../../shared/observability/tracing/traced-handler';
import { DueDate } from '../../../domain/value-objects/due-date';
import { TaskReadModel } from '../../ports/task.read-model';
import { TeamDirectory } from '../../ports/team-directory';
import { assembleTaskView } from '../../views/task-view.assembler';
import type { TaskView } from '../../views/task.view';
import { ListTasksQuery } from './list-tasks.query';

/**
 * Plan 003 → ListTasks. A team filter that is not one of the owner's live teams (unknown,
 * deleted, foreign) is an empty page, and the tasks are not queried (AC-03.3.2). Otherwise one
 * read-model call for the page and its total, and one batched TeamDirectory call for every team
 * on the page, so the query count does not grow with the page size.
 */
@QueryHandler(ListTasksQuery)
export class ListTasksHandler implements IQueryHandler<
  ListTasksQuery,
  Page<TaskView>
> {
  constructor(
    private readonly readModel: TaskReadModel,
    private readonly teams: TeamDirectory,
    private readonly clock: Clock,
  ) {}

  @Traced()
  async execute({
    ownerId,
    criteria,
  }: ListTasksQuery): Promise<Page<TaskView>> {
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
