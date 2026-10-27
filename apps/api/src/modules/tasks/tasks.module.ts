import { Module, Provider } from '@nestjs/common';
import { Clock } from '../../shared/domain/clock';
import { SystemClock } from '../../shared/infrastructure/system-clock';
import { TeamLookup } from '../teams/application/team-lookup.service';
import { TeamsModule } from '../teams/teams.module';
import { TaskReadModel } from './application/interfaces/task-read-model.interface';
import { ChangeTaskStatusUseCase } from './application/use-cases/change-task-status.use-case';
import { CreateTaskUseCase } from './application/use-cases/create-task.use-case';
import { DeleteTaskUseCase } from './application/use-cases/delete-task.use-case';
import { GetTaskUseCase } from './application/use-cases/get-task.use-case';
import { ListTasksUseCase } from './application/use-cases/list-tasks.use-case';
import { UpdateTaskUseCase } from './application/use-cases/update-task.use-case';
import { TeamDirectory } from './application/interfaces/team-directory.interface';
import { TaskRepository } from './domain/repositories/task.repository';
import { PrismaTaskReadModel } from './infrastructure/persistence/task.prisma-read';
import { PrismaTaskRepository } from './infrastructure/persistence/task.prisma-repository';
import { TasksController } from './presentation/tasks.controller';

function bindExisting<T>(
  provide: abstract new (...args: never[]) => T,
  useExisting: new (...args: never[]) => NoInfer<T>,
): Provider {
  return { provide, useExisting };
}

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
    bindExisting(TeamDirectory, TeamLookup),
    { provide: Clock, useClass: SystemClock },
  ],
})
export class TasksModule {}
