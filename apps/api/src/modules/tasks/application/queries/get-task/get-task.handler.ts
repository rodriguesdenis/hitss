import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Clock } from '../../../../../shared/application/ports/clock';
import { Traced } from '../../../../../shared/observability/tracing/traced-handler';
import { TaskNotFound } from '../../../domain/task.errors';
import { DueDate } from '../../../domain/value-objects/due-date';
import { TaskReadModel } from '../../ports/task.read-model';
import { TeamDirectory } from '../../ports/team-directory';
import { assembleTaskView } from '../../views/task-view.assembler';
import type { TaskView } from '../../views/task.view';
import { GetTaskQuery } from './get-task.query';

/**
 * Reads the task, resolves its teams through the TeamDirectory and judges `isOverdue` against
 * today's UTC day from the Clock (plan 003 → GetTask). Unknown, foreign and deleted → TaskNotFound.
 */
@QueryHandler(GetTaskQuery)
export class GetTaskHandler implements IQueryHandler<GetTaskQuery, TaskView> {
  constructor(
    private readonly readModel: TaskReadModel,
    private readonly teams: TeamDirectory,
    private readonly clock: Clock,
  ) {}

  @Traced()
  async execute({ ownerId, id }: GetTaskQuery): Promise<TaskView> {
    const record = await this.readModel.findById(ownerId, id);
    if (!record) {
      throw new TaskNotFound();
    }
    const summaries = await this.teams.summaries(ownerId, record.teamIds);
    return assembleTaskView(
      record,
      summaries,
      DueDate.todayFrom(this.clock.now()),
    );
  }
}
