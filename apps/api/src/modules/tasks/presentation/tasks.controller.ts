import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import type { ServerResponse } from 'node:http';
import type { Owner } from '../../../shared/domain/owner';
import { CurrentOwner } from '../../../shared/presentation/decorators/current-owner.decorator';
import { ApiOkEnvelope } from '../../../shared/presentation/openapi/api-envelope';
import { ParseUuidPipe } from '../../../shared/presentation/pipes/parse-uuid.pipe';
import { CreateTaskCommand } from '../application/commands/create-task/create-task.command';
import { GetTaskQuery } from '../application/queries/get-task/get-task.query';
import type { TaskView } from '../application/views/task.view';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskResponseDto } from './dto/task.response.dto';
import { toTaskResponse } from './task.presenter';

/** `/api/v1/tasks`: private (global auth guard), always scoped to the signed-in owner. */
@Controller('tasks')
@ApiExtraModels(TaskResponseDto)
export class TasksController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  /**
   * 201 with the created task read back through GetTask (same shape as every single-task
   * response), `Location` and the version tag (AC-03.1.1).
   */
  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      required: ['data'],
      properties: { data: { $ref: getSchemaPath(TaskResponseDto) } },
    },
  })
  async create(
    @CurrentOwner() { ownerId }: Owner,
    @Body() body: CreateTaskDto,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<TaskResponseDto> {
    const { id } = await this.commands.execute<
      CreateTaskCommand,
      { id: string }
    >(
      new CreateTaskCommand(
        ownerId,
        body.title,
        body.description,
        body.status,
        body.dueDate,
        body.teamIds,
      ),
    );
    const task = await this.queries.execute<GetTaskQuery, TaskView>(
      new GetTaskQuery(ownerId, id),
    );
    response.setHeader('Location', `/api/v1/tasks/${task.id}`);
    // Until the shared EtagInterceptor (T-002-07) takes over, in the same W/"<version>" form.
    response.setHeader('ETag', `W/"${task.version}"`);
    return toTaskResponse(task);
  }

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
