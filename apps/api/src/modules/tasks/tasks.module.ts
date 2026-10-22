import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { Clock } from '../../shared/domain/clock';
import { IdGenerator } from '../../shared/application/ports/id-generator';
import { SystemClock } from '../../shared/infrastructure/system-clock';
import { UuidGenerator } from '../../shared/infrastructure/uuid-generator';
import { DomainErrorMappings } from '../../shared/presentation/filters/domain-error-mappings';
import { ChangeTaskStatusHandler } from './application/commands/change-task-status/change-task-status.handler';
import { ReplaceTaskHandler } from './application/commands/replace-task/replace-task.handler';
import { DeleteTaskHandler } from './application/commands/delete-task/delete-task.handler';
import { CreateTaskHandler } from './application/commands/create-task/create-task.handler';
import { OnTeamDeletedHandler } from './application/events/on-team-deleted.handler';
import { TaskReadModel } from './application/ports/task.read-model';
import { TeamDirectory } from './application/ports/team-directory';
import { ListTasksHandler } from './application/queries/list-tasks/list-tasks.handler';
import { GetTaskHandler } from './application/queries/get-task/get-task.handler';
import { TeamLookupDirectory } from './infrastructure/adapters/team-directory.adapter';
import { TaskRepository } from './domain/repositories/task.repository';
import { PrismaTaskReadModel } from './infrastructure/persistence/task.prisma-read';
import { PrismaTaskRepository } from './infrastructure/persistence/task.prisma-repository';
import { TASK_ERROR_MAPPINGS } from './presentation/http/task-error.mapping';
import { TasksController } from './presentation/http/tasks.controller';
import { TeamsModule } from '../teams/teams.module';

/**
 * Task Management's composition root: binds its ports to adapters and registers its error
 * table. Teams come from TeamsModule's exported TeamLookup (ADR-0020).
 */
@Module({
  // CqrsModule.forRoot() lives in AppModule only: one root, one EventBus (see cqrs-root.spec.ts).
  imports: [CqrsModule, TeamsModule],
  controllers: [TasksController],
  providers: [
    CreateTaskHandler,
    ReplaceTaskHandler,
    ChangeTaskStatusHandler,
    DeleteTaskHandler,
    GetTaskHandler,
    ListTasksHandler,
    // In DeleteTeam's transaction (@InTransactionHandler(TeamDeleted), T-003-13).
    OnTeamDeletedHandler,
    { provide: TaskRepository, useClass: PrismaTaskRepository },
    { provide: TaskReadModel, useClass: PrismaTaskReadModel },
    // Team names and colors come from Team Management's TeamLookup.
    { provide: TeamDirectory, useClass: TeamLookupDirectory },
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: UuidGenerator },
  ],
})
export class TasksModule implements OnModuleInit {
  constructor(private readonly errorMappings: DomainErrorMappings) {}

  onModuleInit(): void {
    this.errorMappings.register(TASK_ERROR_MAPPINGS);
  }
}
