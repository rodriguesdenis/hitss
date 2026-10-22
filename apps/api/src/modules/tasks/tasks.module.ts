import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { metrics } from '@opentelemetry/api';
import { Clock } from '../../shared/application/ports/clock';
import { SystemClock } from '../../shared/infrastructure/system-clock';
import { DomainErrorMappings } from '../../shared/presentation/filters/domain-error-mappings';
import { TASK_METRICS_HANDLERS } from './application/events/record-task-metrics.handler';
import { TaskMetrics } from './application/ports/task-metrics';
import { TaskReadModel } from './application/ports/task.read-model';
import { TeamDirectory } from './application/ports/team-directory';
import { GetTaskHandler } from './application/queries/get-task/get-task.handler';
import {
  METER_NAME,
  OtelTaskMetrics,
} from './infrastructure/adapters/otel-task-metrics.adapter';
import { QueryBusTeamDirectory } from './infrastructure/adapters/team-directory.adapter';
import { PrismaTaskReadModel } from './infrastructure/prisma-task.read-model';
import { TASK_ERROR_MAPPINGS } from './presentation/task-error.mapping';
import { TasksController } from './presentation/tasks.controller';

/**
 * Task Management's composition root: binds its ports to adapters and registers its error
 * table. It imports no Teams module or provider; teams come through the QueryBus.
 */
@Module({
  // CqrsModule.forRoot() lives in AppModule only: one root, one EventBus (see cqrs-root.spec.ts).
  imports: [CqrsModule],
  controllers: [TasksController],
  providers: [
    GetTaskHandler,
    ...TASK_METRICS_HANDLERS,
    {
      provide: TaskMetrics,
      useFactory: () => new OtelTaskMetrics(metrics.getMeter(METER_NAME)),
    },
    { provide: TaskReadModel, useClass: PrismaTaskReadModel },
    // Team names and colors come from Team Management through the QueryBus (T-003-05).
    { provide: TeamDirectory, useClass: QueryBusTeamDirectory },
    { provide: Clock, useClass: SystemClock },
  ],
})
export class TasksModule implements OnModuleInit {
  constructor(private readonly errorMappings: DomainErrorMappings) {}

  onModuleInit(): void {
    this.errorMappings.register(TASK_ERROR_MAPPINGS);
  }
}
