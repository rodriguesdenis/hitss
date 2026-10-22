import {
  Task,
  TaskProps,
} from '../../src/modules/tasks/domain/entities/task.entity';
import {
  TaskNotFound,
  UnknownTeams,
} from '../../src/modules/tasks/domain/errors/task.errors';
import { TaskRepository } from '../../src/modules/tasks/domain/repositories/task.repository';

/**
 * In-memory TaskRepository for handler unit tests. It passes the same contract suite as the
 * Prisma adapter (task-repository.contract.ts): snapshots in, fresh aggregates out, the same
 * version increment, owner scoping and errors. Team links are part of the snapshot, so a soft delete
 * keeps them, as the database does. Every team id is assumed to exist unless a test marks it
 * missing (`simulateMissingTeam`), which mimics the database's team-link foreign key.
 */
export class InMemoryTaskRepository extends TaskRepository {
  private readonly rows = new Map<string, TaskProps>();
  private readonly missingTeams = new Set<string>();

  /** Makes a team id fail like a team gone after the directory check (UnknownTeams, no ids). */
  simulateMissingTeam(teamId: string): void {
    this.missingTeams.add(teamId);
  }

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
    if (this.linksMissingTeam(task)) {
      return Promise.reject(new UnknownTeams([]));
    }
    this.rows.set(task.id, snapshot(task, 1));
    return Promise.resolve();
  }

  /** Records the requested locks; one process has no concurrent writers to serialize. */
  readonly lockedTeams: string[][] = [];

  lockTeamLinks(teamIds: readonly string[]): Promise<void> {
    this.lockedTeams.push([...teamIds]);
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
    return task.teamIds.values.some((id) => this.missingTeams.has(id));
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
