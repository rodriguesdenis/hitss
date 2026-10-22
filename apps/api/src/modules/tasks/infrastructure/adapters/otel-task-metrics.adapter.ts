import { Injectable } from '@nestjs/common';
import { type Meter, metrics } from '@opentelemetry/api';
import type { TaskMetrics } from '../../application/ports/task-metrics';

export const METER_NAME = 'teams-tasks-api';

/**
 * OpenTelemetry counters behind the TaskMetrics port. With telemetry disabled the API returns
 * no-op instruments, so calling them costs nothing. Counters are added without attributes.
 */
@Injectable()
export class OtelTaskMetrics implements TaskMetrics {
  private readonly created;
  private readonly completed;
  private readonly deleted;

  constructor(meter: Meter = metrics.getMeter(METER_NAME)) {
    this.created = meter.createCounter('tasks_created_total', {
      description: 'Tasks created',
    });
    this.completed = meter.createCounter('tasks_completed_total', {
      description: 'Tasks that reached the DONE status',
    });
    this.deleted = meter.createCounter('tasks_deleted_total', {
      description: 'Tasks deleted',
    });
  }

  taskCreated(): void {
    this.created.add(1);
  }

  taskCompleted(): void {
    this.completed.add(1);
  }

  taskDeleted(): void {
    this.deleted.add(1);
  }
}
