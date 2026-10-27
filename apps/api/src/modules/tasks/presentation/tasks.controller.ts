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
} from '@nestjs/common';
import type { Owner } from '../../../shared/domain/owner';
import { Location } from '../../../shared/presentation/decorators/location.decorator';
import { CurrentOwner } from '../../../shared/presentation/decorators/current-owner.decorator';
import { IdParamDto } from '../../../shared/presentation/dto/id-param.dto';
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
import { TaskPageResponseDto } from './dto/task-page-response.dto';
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
  @Location()
  @ApiCreateTask()
  async create(
    @CurrentOwner() { ownerId }: Owner,
    @Body() body: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    const view = await this.createTask.execute({ ...body, ownerId });
    return TaskResponseDto.from(view);
  }

  @Get()
  @ApiListTasks()
  async list(
    @CurrentOwner() { ownerId }: Owner,
    @Query() query: ListTasksQueryDto,
  ): Promise<TaskPageResponseDto> {
    const found = await this.listTasks.execute({
      ownerId,
      criteria: query.toCriteria(),
    });
    return TaskPageResponseDto.from(found, query);
  }

  @Get(':id')
  @ApiGetTask()
  async get(
    @CurrentOwner() { ownerId }: Owner,
    @Param() { id }: IdParamDto,
  ): Promise<TaskResponseDto> {
    const view = await this.getTask.execute({ ownerId, id });
    return TaskResponseDto.from(view);
  }

  @Patch(':id/status')
  @ApiChangeTaskStatus()
  async changeStatus(
    @CurrentOwner() { ownerId }: Owner,
    @Param() { id }: IdParamDto,
    @Body() body: ChangeTaskStatusDto,
  ): Promise<TaskResponseDto> {
    const view = await this.changeTaskStatus.execute({ ...body, ownerId, id });
    return TaskResponseDto.from(view);
  }

  @Put(':id')
  @ApiReplaceTask()
  async replace(
    @CurrentOwner() { ownerId }: Owner,
    @Param() { id }: IdParamDto,
    @Body() body: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    const view = await this.updateTask.execute({ ...body, ownerId, id });
    return TaskResponseDto.from(view);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiDeleteTask()
  async delete(
    @CurrentOwner() { ownerId }: Owner,
    @Param() { id }: IdParamDto,
  ): Promise<void> {
    await this.deleteTask.execute({ ownerId, id });
  }
}
