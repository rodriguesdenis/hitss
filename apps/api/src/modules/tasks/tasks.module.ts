import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { metrics } from '@opentelemetry/api';
import { TASK_METRICS_HANDLERS } from './application/events/record-task-metrics.handler';
import { TaskMetrics } from './application/ports/task-metrics';
import {
  METER_NAME,
  OtelTaskMetrics,
} from './infrastructure/adapters/otel-task-metrics.adapter';

// CqrsModule.forRoot() lives in AppModule only: one root, one EventBus (see cqrs-root.spec.ts).
@Module({
  imports: [CqrsModule],
  providers: [
    ...TASK_METRICS_HANDLERS,
    {
      provide: TaskMetrics,
      useFactory: () => new OtelTaskMetrics(metrics.getMeter(METER_NAME)),
    },
  ],
})
export class TasksModule {}
