import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { metrics } from '@opentelemetry/api';
import { TASK_METRICS_HANDLERS } from './application/events/record-task-metrics.handler';
import { TaskMetrics } from './application/ports/task-metrics';
import { TeamDirectory } from './application/ports/team-directory';
import {
  METER_NAME,
  OtelTaskMetrics,
} from './infrastructure/adapters/otel-task-metrics.adapter';
import { QueryBusTeamDirectory } from './infrastructure/adapters/team-directory.adapter';

// CqrsModule.forRoot() lives in AppModule only: one root, one EventBus (see cqrs-root.spec.ts).
@Module({
  imports: [CqrsModule],
  providers: [
    ...TASK_METRICS_HANDLERS,
    {
      provide: TaskMetrics,
      useFactory: () => new OtelTaskMetrics(metrics.getMeter(METER_NAME)),
    },
    // Team names and colors come from Team Management through the QueryBus (T-003-05).
    { provide: TeamDirectory, useClass: QueryBusTeamDirectory },
  ],
})
export class TasksModule {}
