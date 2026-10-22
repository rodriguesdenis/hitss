import type { Meter } from '@opentelemetry/api';
import { TaskMetrics } from '../../application/ports/task-metrics';

export const METER_NAME = 'teams-tasks-api';

/**
 * OpenTelemetry counters behind the TaskMetrics port. Built by TasksModule with the global meter. With telemetry disabled the API returns
 * no-op instruments, so calling them costs nothing. Counters are added without attributes.
 */
export class OtelTaskMetrics extends TaskMetrics {
  private readonly created;
  private readonly completed;
  private readonly deleted;

  constructor(meter: Meter) {
    super();
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
