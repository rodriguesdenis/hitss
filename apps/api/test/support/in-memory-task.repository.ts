import { ConcurrencyConflict } from '../../src/shared/domain/domain-error';
import { Task, TaskProps } from '../../src/modules/tasks/domain/task';
import { TaskNotFound } from '../../src/modules/tasks/domain/task.errors';
import { TaskRepository } from '../../src/modules/tasks/domain/task.repository';

/**
 * In-memory TaskRepository for handler unit tests. It passes the same contract suite as the
 * Prisma adapter (task-repository.contract.ts): snapshots in, fresh aggregates out, the same
 * version guard, owner scoping and errors. Team links are part of the snapshot, so a soft delete
 * keeps them, as the database does.
 */
export class InMemoryTaskRepository extends TaskRepository {
  private readonly rows = new Map<string, TaskProps>();

  /** Stores a task as-is (its own version). For test setup. */
  seed(task: Task): void {
    this.rows.set(task.id, snapshot(task, task.version));
  }

  /** Every stored task, deleted ones included, as fresh aggregates. */
  all(): Task[] {
    return [...this.rows.values()].map((row) => Task.reconstitute(row));
  }

  findById(ownerId: string, id: string): Promise<Task | null> {
    const row = this.rows.get(id);
    const visible = row && row.ownerId === ownerId && row.deletedAt === null;
    return Promise.resolve(visible ? Task.reconstitute(row) : null);
  }

  findByTeam(ownerId: string, teamId: string): Promise<Task[]> {
    const tasks = [...this.rows.values()]
      .filter(
        (row) =>
          row.ownerId === ownerId &&
          row.deletedAt === null &&
          row.teamIds.values.includes(teamId),
      )
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((row) => Task.reconstitute(row));
    return Promise.resolve(tasks);
  }

  insert(task: Task): Promise<void> {
    if (this.rows.has(task.id)) {
      return Promise.reject(new Error(`Duplicate task id ${task.id}`));
    }
    this.rows.set(task.id, snapshot(task, 1));
    return Promise.resolve();
  }

  update(task: Task, expectedVersion: number): Promise<number> {
    const row = this.rows.get(task.id);
    if (!row || row.ownerId !== task.ownerId || row.deletedAt !== null) {
      return Promise.reject(new TaskNotFound());
    }
    if (row.version !== expectedVersion) {
      return Promise.reject(new ConcurrencyConflict(row.version));
    }
    const version = expectedVersion + 1;
    this.rows.set(task.id, snapshot(task, version));
    return Promise.resolve(version);
  }
}

function snapshot(task: Task, version: number): TaskProps {
  return {
    id: task.id,
    ownerId: task.ownerId,
    title: task.title,
    description: task.description,
    status: task.status,
    dueDate: task.dueDate,
    teamIds: task.teamIds,
    completedAt: task.completedAt,
    version,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    deletedAt: task.deletedAt,
  };
}
