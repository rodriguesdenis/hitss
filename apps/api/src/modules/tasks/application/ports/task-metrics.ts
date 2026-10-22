/**
 * Business counters of the tasks context. Each call counts one persisted state change and carries
 * no attributes, so no id, email or URL can reach a metric dimension (AC-06.4.4).
 * An abstract class so it doubles as the Nest DI token (overview 3.2).
 */
export abstract class TaskMetrics {
  abstract taskCreated(): void;
  abstract taskCompleted(): void;
  abstract taskDeleted(): void;
}
