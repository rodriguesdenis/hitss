import { Module, OnModuleInit } from '@nestjs/common';
import { Clock } from '../../shared/domain/clock';
import { SystemClock } from '../../shared/infrastructure/system-clock';
import { DomainErrorMappings } from '../../shared/presentation/filters/domain-error-mappings';
import { TeamsModule } from '../teams/teams.module';
import { TaskReadModel } from './application/ports/task.read-model';
import { ChangeTaskStatusUseCase } from './application/use-cases/change-task-status.use-case';
import { CreateTaskUseCase } from './application/use-cases/create-task.use-case';
import { DeleteTaskUseCase } from './application/use-cases/delete-task.use-case';
import { GetTaskUseCase } from './application/use-cases/get-task.use-case';
import { ListTasksUseCase } from './application/use-cases/list-tasks.use-case';
import { UpdateTaskUseCase } from './application/use-cases/update-task.use-case';
import { TaskRepository } from './domain/repositories/task.repository';
import { PrismaTaskReadModel } from './infrastructure/persistence/task.prisma-read';
import { PrismaTaskRepository } from './infrastructure/persistence/task.prisma-repository';
import { TASK_ERROR_MAPPINGS } from './presentation/http/task-error.mapping';
import { TasksController } from './presentation/http/tasks.controller';

@Module({
  imports: [TeamsModule],
  controllers: [TasksController],
  providers: [
    CreateTaskUseCase,
    UpdateTaskUseCase,
    ChangeTaskStatusUseCase,
    DeleteTaskUseCase,
    GetTaskUseCase,
    ListTasksUseCase,
    { provide: TaskRepository, useClass: PrismaTaskRepository },
    { provide: TaskReadModel, useClass: PrismaTaskReadModel },
    { provide: Clock, useClass: SystemClock },
  ],
})
export class TasksModule implements OnModuleInit {
  constructor(private readonly errorMappings: DomainErrorMappings) {}

  onModuleInit(): void {
    this.errorMappings.register(TASK_ERROR_MAPPINGS);
  }
}
