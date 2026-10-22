import { Controller, Get, Param, Res } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { ServerResponse } from 'node:http';
import type { Owner } from '../../../shared/domain/owner';
import { CurrentOwner } from '../../../shared/presentation/decorators/current-owner.decorator';
import { ApiOkEnvelope } from '../../../shared/presentation/openapi/api-envelope';
import { ParseUuidPipe } from '../../../shared/presentation/pipes/parse-uuid.pipe';
import { GetTaskQuery } from '../application/queries/get-task/get-task.query';
import type { TaskView } from '../application/views/task.view';
import { TaskResponseDto } from './dto/task.response.dto';
import { toTaskResponse } from './task.presenter';

/** `/api/v1/tasks`: private (global auth guard), always scoped to the signed-in owner. */
@Controller('tasks')
export class TasksController {
  constructor(private readonly queries: QueryBus) {}

  /** 200 with the task view and its version tag (AC-03.8.1); unknown → 404 TASK_NOT_FOUND. */
  @Get(':id')
  @ApiOkEnvelope(TaskResponseDto)
  async get(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<TaskResponseDto> {
    const task = await this.queries.execute<GetTaskQuery, TaskView>(
      new GetTaskQuery(ownerId, id),
    );
    // Until the shared EtagInterceptor (T-002-07) takes over, in the same W/"<version>" form.
    response.setHeader('ETag', `W/"${task.version}"`);
    return toTaskResponse(task);
  }
}
