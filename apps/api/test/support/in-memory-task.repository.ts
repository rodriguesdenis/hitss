import {
  Task,
  TaskProps,
} from '../../src/modules/tasks/domain/entities/task.entity';
import {
  TaskNotFound,
  UnknownTeams,
} from '../../src/modules/tasks/domain/errors/task.errors';
import { TaskRepository } from '../../src/modules/tasks/domain/repositories/task.repository';

export class InMemoryTaskRepository extends TaskRepository {
  private readonly rows = new Map<string, TaskProps>();
  private readonly missingTeams = new Set<string>();

  simulateMissingTeam(teamId: string): void {
    this.missingTeams.add(teamId);
  }

  seed(task: Task): void {
    this.rows.set(task.id, snapshot(task, task.version));
  }

  all(): Task[] {
    return [...this.rows.values()].map((row) => Task.restore(row));
  }

  findById(ownerId: string, id: string): Promise<Task | null> {
    const row = this.rows.get(id);
    const visible = row && row.ownerId === ownerId && row.deletedAt === null;
    return Promise.resolve(visible ? Task.restore(row) : null);
  }

  insert(task: Task): Promise<void> {
    if (this.rows.has(task.id)) {
      return Promise.reject(new Error(`Duplicate task id ${task.id}`));
    }
    if (this.linksMissingTeam(task)) {
      return Promise.reject(new UnknownTeams([]));
    }
    this.rows.set(task.id, snapshot(task, 1));
    return Promise.resolve();
  }

  update(task: Task): Promise<void> {
    const row = this.rows.get(task.id);
    if (!row || row.ownerId !== task.ownerId || row.deletedAt !== null) {
      return Promise.reject(new TaskNotFound());
    }
    if (this.linksMissingTeam(task)) {
      return Promise.reject(new UnknownTeams([]));
    }
    const version = row.version + 1;
    this.rows.set(task.id, snapshot(task, version));
    return Promise.resolve();
  }

  private linksMissingTeam(task: Task): boolean {
    return task.teamIds.some((id) => this.missingTeams.has(id));
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
