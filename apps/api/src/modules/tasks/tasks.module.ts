import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TASK_METRICS_HANDLERS } from './application/events/record-task-metrics.handler';
import { TASK_METRICS } from './application/ports/task-metrics';
import { OtelTaskMetrics } from './infrastructure/adapters/otel-task-metrics.adapter';

@Module({
  imports: [CqrsModule.forRoot()],
  providers: [
    ...TASK_METRICS_HANDLERS,
    { provide: TASK_METRICS, useClass: OtelTaskMetrics },
  ],
})
export class TasksModule {}
