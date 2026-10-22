import { Task } from '../entities/task.entity';

export abstract class TaskRepository {
  abstract findById(ownerId: string, id: string): Promise<Task | null>;

  abstract insert(task: Task): Promise<void>;

  abstract update(task: Task): Promise<void>;
}
