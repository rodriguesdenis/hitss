import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiExtraModels, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { ServerResponse } from 'node:http';
import type { Page } from '../../../shared/application/page';
import type { Owner } from '../../../shared/domain/owner';
import { CurrentOwner } from '../../../shared/presentation/decorators/current-owner.decorator';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiPageEnvelope,
} from '../../../shared/presentation/openapi/api-envelope';
import { ApiErrorResponses } from '../../../shared/presentation/openapi/api-error';
import type { PageMeta } from '../../../shared/presentation/openapi/api-envelope';
import { toPageMeta } from '../../../shared/presentation/page-meta';
import { parseSort } from '../../../shared/presentation/sort';
import { EtagInterceptor } from '../../../shared/presentation/interceptors/etag.interceptor';
import { ParseUuidPipe } from '../../../shared/presentation/pipes/parse-uuid.pipe';
import { ChangeTaskStatusCommand } from '../application/commands/change-task-status/change-task-status.command';
import { CreateTaskCommand } from '../application/commands/create-task/create-task.command';
import { ReplaceTaskCommand } from '../application/commands/replace-task/replace-task.command';
import { DeleteTaskCommand } from '../application/commands/delete-task/delete-task.command';
import type { TaskSortField } from '../application/ports/task.read-model';
import { ListTasksQuery } from '../application/queries/list-tasks/list-tasks.query';
import { GetTaskQuery } from '../application/queries/get-task/get-task.query';
import type { TaskView } from '../application/views/task.view';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { ReplaceTaskDto } from './dto/replace-task.dto';
import { TaskResponseDto } from './dto/task.response.dto';
import { toTaskResponse } from './task.presenter';

/** `/api/v1/tasks`: private (global auth guard), always scoped to the signed-in owner. */
@ApiTags('Tasks')
// Every route needs a bearer token and is rate limited.
@ApiErrorResponses([401, 429])
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
  @UseInterceptors(EtagInterceptor)
  @HttpCode(201)
  @ApiCreatedEnvelope(TaskResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: an invalid or unknown field (teamIds malformed, duplicated or over 100 included); `details` names it.',
    413: 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.',
    422: 'TOO_MANY_TEAMS (`details: { max, received }`, more than 10 distinct teams) or UNKNOWN_TEAMS (`details: { teamIds }`, the ids that are not your live teams).',
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
    return toTaskResponse(task); // ETag: EtagInterceptor
  }

  /**
   * 200 with a page of the owner's active tasks as full task views, newest first, and `meta`
   * (AC-03.2.1, AC-03.2.2). Filters combine with AND; statuses within the list with OR
   * (AC-03.4.4). Search is literal and case-insensitive on title or description; the sort is
   * whitelisted with an id tie-break (AC-03.5.x, AC-03.6.x). Foreign and deleted tasks are never
   * listed nor counted (AC-03.2.3).
   */
  @Get()
  @ApiPageEnvelope(TaskResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: limit, offset, teamId, status, search, sort or an unknown parameter. A teamId that is not your live team is an empty page, not an error.',
  })
  async list(
    @CurrentOwner() { ownerId }: Owner,
    @Query() query: ListTasksQueryDto,
  ): Promise<{ data: TaskResponseDto[]; meta: PageMeta }> {
    const page = { limit: query.limit, offset: query.offset };
    const { items, total } = await this.queries.execute<
      ListTasksQuery,
      Page<TaskView>
    >(
      new ListTasksQuery(ownerId, {
        page,
        teamId: query.teamId,
        statuses: query.status && [...new Set(query.status)],
        search: query.search,
        sort: parseSort(query.sort as TaskSortField | `-${TaskSortField}`),
      }),
    );
    return {
      data: items.map(toTaskResponse),
      meta: toPageMeta(page, items.length, total),
    };
  }

  /** 200 with the task view and its version tag (AC-03.8.1); unknown → 404 TASK_NOT_FOUND. */
  @Get(':id')
  @UseInterceptors(EtagInterceptor)
  @ApiOkEnvelope(TaskResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: `id` is not a UUID.',
    404: 'TASK_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
  })
  async get(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<TaskResponseDto> {
    const task = await this.queries.execute<GetTaskQuery, TaskView>(
      new GetTaskQuery(ownerId, id),
    );
    return toTaskResponse(task); // ETag: EtagInterceptor
  }

  /**
   * 200 with the task read back and its version tag (AC-03.10.1). The same status is a no-op:
   * the unchanged task and the same tag (AC-03.10.3).
   */
  @Patch(':id/status')
  @UseInterceptors(EtagInterceptor)
  @ApiOkEnvelope(TaskResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: `id` is not a UUID, `status` is missing or invalid, or another field is sent.',
    404: 'TASK_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
    412: 'PRECONDITION_FAILED: rare; a concurrent write won twice in a row (the server retries once). Reload and retry; `details.currentVersion`.',
    413: 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.',
  })
  async changeStatus(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: ChangeTaskStatusDto,
  ): Promise<TaskResponseDto> {
    await this.commands.execute<ChangeTaskStatusCommand, { id: string }>(
      new ChangeTaskStatusCommand(ownerId, id, body.status),
    );
    const task = await this.queries.execute<GetTaskQuery, TaskView>(
      new GetTaskQuery(ownerId, id),
    );
    return toTaskResponse(task); // ETag: EtagInterceptor
  }

  /**
   * 200 with the replaced task read back and its version tag (AC-03.9.1). An identical
   * replacement is a no-op: the unchanged task and the same tag (AC-03.9.5).
   */
  @Put(':id')
  @UseInterceptors(EtagInterceptor)
  @ApiOkEnvelope(TaskResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: an invalid or unknown field, or `id` not a UUID; `details` names it.',
    404: 'TASK_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which); wins over 422.',
    412: 'PRECONDITION_FAILED: rare; a concurrent write won twice in a row (the server retries once). Reload and retry; `details.currentVersion`.',
    413: 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.',
    422: 'TOO_MANY_TEAMS (`details: { max, received }`, more than 10 distinct teams) or UNKNOWN_TEAMS (`details: { teamIds }`, the ids that are not your live teams).',
  })
  async replace(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: ReplaceTaskDto,
  ): Promise<TaskResponseDto> {
    await this.commands.execute<ReplaceTaskCommand, { id: string }>(
      new ReplaceTaskCommand(
        ownerId,
        id,
        body.title,
        body.status,
        body.teamIds,
        body.description,
        body.dueDate,
      ),
    );
    const task = await this.queries.execute<GetTaskQuery, TaskView>(
      new GetTaskQuery(ownerId, id),
    );
    return toTaskResponse(task); // ETag: EtagInterceptor
  }

  /** 204 with no content; afterwards every read and write of the task → 404 (AC-03.11.1). */
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'The task was deleted.' })
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: `id` is not a UUID.',
    404: 'TASK_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
    412: 'PRECONDITION_FAILED: rare; a concurrent write won twice in a row (the server retries once). Reload and retry; `details.currentVersion`.',
  })
  async delete(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.commands.execute<DeleteTaskCommand, void>(
      new DeleteTaskCommand(ownerId, id),
    );
  }
}
