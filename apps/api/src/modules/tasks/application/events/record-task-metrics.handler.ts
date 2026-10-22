import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  TaskCreated,
  TaskDeleted,
  TaskStatusChanged,
} from '../../domain/task.events';
import { TaskStatus } from '../../domain/value-objects/task-status';
import { TaskMetrics } from '../ports/task-metrics';

// Events are published after the repository commit, so these count stored changes only (BR-06.6).

@EventsHandler(TaskCreated)
export class RecordTaskCreatedMetrics implements IEventHandler<TaskCreated> {
  constructor(private readonly metrics: TaskMetrics) {}

  handle(event: TaskCreated): void {
    this.metrics.taskCreated();
    // A task created as DONE is also completed (see TaskCreated).
    if (event.status === TaskStatus.DONE) this.metrics.taskCompleted();
  }
}

@EventsHandler(TaskStatusChanged)
export class RecordTaskCompletedMetrics implements IEventHandler<TaskStatusChanged> {
  constructor(private readonly metrics: TaskMetrics) {}

  handle(event: TaskStatusChanged): void {
    if (event.to === TaskStatus.DONE) this.metrics.taskCompleted();
  }
}

@EventsHandler(TaskDeleted)
export class RecordTaskDeletedMetrics implements IEventHandler<TaskDeleted> {
  constructor(private readonly metrics: TaskMetrics) {}

  handle(): void {
    this.metrics.taskDeleted();
  }
}

export const TASK_METRICS_HANDLERS = [
  RecordTaskCreatedMetrics,
  RecordTaskCompletedMetrics,
  RecordTaskDeletedMetrics,
];
