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
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { ServerResponse } from 'node:http';
import type { Owner } from '../../../../shared/domain/owner';
import { CurrentOwner } from '../../../../shared/presentation/decorators/current-owner.decorator';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiPageEnvelope,
} from '../../../../shared/presentation/openapi/api-envelope';
import { ApiErrorResponses } from '../../../../shared/presentation/openapi/api-error';
import type { PageMeta } from '../../../../shared/presentation/openapi/api-envelope';
import { toPageMeta } from '../../../../shared/presentation/page-meta';
import { parseSort } from '../../../../shared/presentation/sort';
import { ParseUuidPipe } from '../../../../shared/presentation/pipes/parse-uuid.pipe';
import type { TaskSortField } from '../../application/interfaces/task-read-model.interface';
import { ChangeTaskStatusUseCase } from '../../application/use-cases/change-task-status.use-case';
import { CreateTaskUseCase } from '../../application/use-cases/create-task.use-case';
import { DeleteTaskUseCase } from '../../application/use-cases/delete-task.use-case';
import { GetTaskUseCase } from '../../application/use-cases/get-task.use-case';
import { ListTasksUseCase } from '../../application/use-cases/list-tasks.use-case';
import { UpdateTaskUseCase } from '../../application/use-cases/update-task.use-case';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('Tasks')
@ApiErrorResponses([401, 429])
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly createTask: CreateTaskUseCase,
    private readonly updateTask: UpdateTaskUseCase,
    private readonly changeTaskStatus: ChangeTaskStatusUseCase,
    private readonly deleteTask: DeleteTaskUseCase,
    private readonly getTask: GetTaskUseCase,
    private readonly listTasks: ListTasksUseCase,
  ) {}

  @Post()
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
    const id = await this.createTask.execute({
      ownerId,
      title: body.title,
      description: body.description,
      status: body.status,
      dueDate: body.dueDate,
      teamIds: body.teamIds,
    });
    const view = await this.getTask.execute({ ownerId, id });
    response.setHeader('Location', `/api/v1/tasks/${view.id}`);
    return TaskResponseDto.from(view);
  }

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
    const found = await this.listTasks.execute({
      ownerId,
      criteria: {
        page,
        teamId: query.teamId,
        statuses: query.status && [...new Set(query.status)],
        search: query.search,
        sort: parseSort(query.sort as TaskSortField | `-${TaskSortField}`),
      },
    });
    return {
      data: found.items.map((task) => TaskResponseDto.from(task)),
      meta: toPageMeta(page, found.items.length, found.total),
    };
  }

  @Get(':id')
  @ApiOkEnvelope(TaskResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: `id` is not a UUID.',
    404: 'TASK_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
  })
  async get(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.from(await this.getTask.execute({ ownerId, id }));
  }

  @Patch(':id/status')
  @ApiOkEnvelope(TaskResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: `id` is not a UUID, `status` is missing or invalid, or another field is sent.',
    404: 'TASK_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
    413: 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.',
  })
  async changeStatus(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: ChangeTaskStatusDto,
  ): Promise<TaskResponseDto> {
    await this.changeTaskStatus.execute({ ownerId, id, status: body.status });
    return TaskResponseDto.from(await this.getTask.execute({ ownerId, id }));
  }

  @Put(':id')
  @ApiOkEnvelope(TaskResponseDto)
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: an invalid or unknown field, or `id` not a UUID; `details` names it.',
    404: 'TASK_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which); wins over 422.',
    413: 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.',
    422: 'TOO_MANY_TEAMS (`details: { max, received }`, more than 10 distinct teams) or UNKNOWN_TEAMS (`details: { teamIds }`, the ids that are not your live teams).',
  })
  async replace(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    await this.updateTask.execute({
      ownerId,
      id,
      title: body.title,
      status: body.status,
      teamIds: body.teamIds,
      description: body.description,
      dueDate: body.dueDate,
    });
    return TaskResponseDto.from(await this.getTask.execute({ ownerId, id }));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'The task was deleted.' })
  @ApiErrorResponses({
    400: 'VALIDATION_FAILED: `id` is not a UUID.',
    404: 'TASK_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).',
  })
  async delete(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.deleteTask.execute({ ownerId, id });
  }
}
