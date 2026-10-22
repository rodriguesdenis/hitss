/**
 * Business counters of the tasks context. Each call counts one persisted state change and carries
 * no attributes, so no id, email or URL can reach a metric dimension (AC-06.4.4).
 */
export interface TaskMetrics {
  taskCreated(): void;
  taskCompleted(): void;
  taskDeleted(): void;
}

export const TASK_METRICS = Symbol('TASK_METRICS');
