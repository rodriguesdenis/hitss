import { randomUUID } from 'node:crypto';
import { InMemoryTaskRepository } from './in-memory-task.repository';
import { describeTaskRepositoryContract } from './task-repository.contract';

describe('InMemoryTaskRepository', () => {
  let repository: InMemoryTaskRepository;

  beforeEach(() => {
    repository = new InMemoryTaskRepository();
  });

  describeTaskRepositoryContract(() => ({
    repository,
    newOwner: () => Promise.resolve(randomUUID()),
    newTeam: () => Promise.resolve(randomUUID()),
  }));
});
