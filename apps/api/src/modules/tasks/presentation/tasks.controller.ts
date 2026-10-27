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
import type { ServerResponse } from 'node:http';
import type { Owner } from '../../../shared/domain/owner';
import { CurrentOwner } from '../../../shared/presentation/decorators/current-owner.decorator';
import type { PageMeta } from '../../../shared/presentation/openapi/api-envelope';
import { toPageMeta } from '../../../shared/presentation/page-meta';
import { parseSort } from '../../../shared/presentation/sort';
import { ParseUuidPipe } from '../../../shared/presentation/pipes/parse-uuid.pipe';
import type { TaskSortField } from '../application/interfaces/task-read-model.interface';
import { ChangeTaskStatusUseCase } from '../application/use-cases/change-task-status.use-case';
import { CreateTaskUseCase } from '../application/use-cases/create-task.use-case';
import { DeleteTaskUseCase } from '../application/use-cases/delete-task.use-case';
import { GetTaskUseCase } from '../application/use-cases/get-task.use-case';
import { ListTasksUseCase } from '../application/use-cases/list-tasks.use-case';
import { UpdateTaskUseCase } from '../application/use-cases/update-task.use-case';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import {
  ApiTasks,
  ApiCreateTask,
  ApiListTasks,
  ApiGetTask,
  ApiChangeTaskStatus,
  ApiReplaceTask,
  ApiDeleteTask,
} from './docs/tasks.docs';
import { TaskResponseDto } from './dto/task-response.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTasks()
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
  @ApiCreateTask()
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
  @ApiListTasks()
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
  @ApiGetTask()
  async get(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.from(await this.getTask.execute({ ownerId, id }));
  }

  @Patch(':id/status')
  @ApiChangeTaskStatus()
  async changeStatus(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: ChangeTaskStatusDto,
  ): Promise<TaskResponseDto> {
    await this.changeTaskStatus.execute({ ownerId, id, status: body.status });
    return TaskResponseDto.from(await this.getTask.execute({ ownerId, id }));
  }

  @Put(':id')
  @ApiReplaceTask()
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
  @ApiDeleteTask()
  async delete(
    @CurrentOwner() { ownerId }: Owner,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.deleteTask.execute({ ownerId, id });
  }
}
