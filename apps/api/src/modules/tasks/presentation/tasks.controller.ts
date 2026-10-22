import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import type { ServerResponse } from 'node:http';
import type { Owner } from '../../../shared/domain/owner';
import { CurrentOwner } from '../../../shared/presentation/decorators/current-owner.decorator';
import { ApiOkEnvelope } from '../../../shared/presentation/openapi/api-envelope';
import { ParseUuidPipe } from '../../../shared/presentation/pipes/parse-uuid.pipe';
import { ChangeTaskStatusCommand } from '../application/commands/change-task-status/change-task-status.command';
import { CreateTaskCommand } from '../application/commands/create-task/create-task.command';
import { DeleteTaskCommand } from '../application/commands/delete-task/delete-task.command';
import { GetTaskQuery } from '../application/queries/get-task/get-task.query';
import type { TaskView } from '../application/views/task.view';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
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

  /**
   * 200 with the task read back and its version tag (AC-03.10.1). The same status is a no-op:
   * the unchanged task and the same tag (AC-03.10.3).
   */
  @Patch(':id/status')
  @ApiOkEnvelope(TaskResponseDto)
  async changeStatus(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: ChangeTaskStatusDto,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<TaskResponseDto> {
    await this.commands.execute<ChangeTaskStatusCommand, { id: string }>(
      new ChangeTaskStatusCommand(ownerId, id, body.status),
    );
    const task = await this.queries.execute<GetTaskQuery, TaskView>(
      new GetTaskQuery(ownerId, id),
    );
    // Until the shared EtagInterceptor (T-002-07) takes over, in the same W/"<version>" form.
    response.setHeader('ETag', `W/"${task.version}"`);
    return toTaskResponse(task);
  }

  /** 204 with no content; afterwards every read and write of the task → 404 (AC-03.11.1). */
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  async delete(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.commands.execute<DeleteTaskCommand, void>(
      new DeleteTaskCommand(ownerId, id),
    );
  }
}
