import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/domain/clock';
import { TeamLookup } from '../../../teams/team-lookup.service';
import { TaskNotFound } from '../../domain/errors/task.errors';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import { TaskReadModel } from '../ports/task.read-model';
import { assembleTaskView } from '../views/task-view.assembler';
import type { TaskView } from '../views/task.view';

export interface GetTaskInput {
  readonly ownerId: string;
  readonly id: string;
}

/**
 * Reads the task, resolves its teams through TeamLookup and judges `isOverdue` against today's
 * UTC day from the Clock. Unknown, foreign and deleted → TaskNotFound (AC-03.8.2).
 */
@Injectable()
export class GetTaskUseCase {
  constructor(
    private readonly readModel: TaskReadModel,
    private readonly teams: TeamLookup,
    private readonly clock: Clock,
  ) {}

  async execute({ ownerId, id }: GetTaskInput): Promise<TaskView> {
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
